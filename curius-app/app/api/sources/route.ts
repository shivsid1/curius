import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { clampPagination } from '@/lib/api-pagination';

// Reads searchParams (page/limit/sort) so must be dynamic.
export const dynamic = 'force-dynamic';

// Batch .in() queries to avoid URL length limits
async function fetchTagsInBatches(bookmarkIds: number[]) {
  const batchSize = 500;
  const allTags: Array<{ bookmark_id: number; topic: string }> = [];

  for (let i = 0; i < bookmarkIds.length; i += batchSize) {
    const batch = bookmarkIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('bookmark_tags_v2')
      .select('bookmark_id, topic')
      .in('bookmark_id', batch);
    if (data) allTags.push(...data);
  }

  return allTags;
}

interface DomainAggregate {
  domain: string;
  bookmark_count: number;
  total_saves: number;
  max_id: number;
}

// Aggregate domain stats at the DB layer via PostgREST's aggregate functions.
// Replaces a JS-side aggregation that paginated through ~183k rows in 10k batches.
async function fetchDomainAggregates(): Promise<DomainAggregate[]> {
  // PostgREST returns one row per domain when aggregate functions are mixed
  // with a non-aggregated column (implicit GROUP BY domain).
  const { data, error } = await supabase
    .from('bookmarks')
    .select('domain, bookmark_count:id.count(), total_saves:saves_count.sum(), max_id:id.max()')
    .not('domain', 'is', null)
    .returns<DomainAggregate[]>();

  if (error) throw error;
  return data ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = clampPagination(searchParams, { defaultLimit: 30 });
    const sort = searchParams.get('sort') || 'saves';

    // Aggregate by domain at the DB layer
    const aggregates = await fetchDomainAggregates();

    const domains = aggregates
      .filter((a) => a.domain)
      .map((a) => ({
        domain: a.domain,
        bookmark_count: a.bookmark_count ?? 0,
        total_saves: a.total_saves ?? 0,
        maxId: a.max_id ?? 0,
        top_topics: [] as Array<{ topic: string; count: number }>,
      }));

    if (sort === 'count') {
      domains.sort((a, b) => b.bookmark_count - a.bookmark_count);
    } else if (sort === 'recent') {
      domains.sort((a, b) => b.maxId - a.maxId);
    } else {
      domains.sort((a, b) => b.total_saves - a.total_saves);
    }

    // Paginate
    const total = domains.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedDomains = domains.slice(offset, offset + limit);

    // For paginated domains, fetch top topics
    if (paginatedDomains.length > 0) {
      const domainNames = paginatedDomains.map((d) => d.domain);

      // Get bookmark IDs for these domains (capped for perf)
      const { data: domainBookmarks } = await supabase
        .from('bookmarks')
        .select('id, domain')
        .in('domain', domainNames)
        .limit(5000);

      if (domainBookmarks && domainBookmarks.length > 0) {
        const bookmarkIds = domainBookmarks.map((b) => b.id);
        const domainByBookmarkId = new Map<number, string>();
        for (const b of domainBookmarks) {
          domainByBookmarkId.set(b.id, b.domain);
        }

        // Fetch tags in batches to avoid URL length limits
        const tags = await fetchTagsInBatches(bookmarkIds);

        if (tags.length > 0) {
          const domainTopics = new Map<string, Map<string, number>>();

          for (const tag of tags) {
            const domain = domainByBookmarkId.get(tag.bookmark_id);
            if (!domain) continue;

            if (!domainTopics.has(domain)) {
              domainTopics.set(domain, new Map());
            }
            const topicMap = domainTopics.get(domain)!;
            topicMap.set(tag.topic, (topicMap.get(tag.topic) || 0) + 1);
          }

          for (const d of paginatedDomains) {
            const topicMap = domainTopics.get(d.domain);
            if (topicMap) {
              d.top_topics = Array.from(topicMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([topic, count]) => ({ topic, count }));
            }
          }
        }
      }
    }

    // Strip internal maxId before returning
    const data = paginatedDomains.map(({ maxId: _maxId, ...rest }) => rest);

    return NextResponse.json(
      {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
