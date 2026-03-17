import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

async function fetchAllBookmarks() {
  const allBookmarks: Array<{ id: number; domain: string; saves_count: number }> = [];
  const batchSize = 10000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('id, domain, saves_count')
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allBookmarks.push(...data);
      offset += batchSize;
      if (data.length < batchSize) hasMore = false;
    }
  }

  return allBookmarks;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
    const sort = searchParams.get('sort') || 'saves';

    // Fetch all bookmarks in batches for aggregation
    const bookmarks = await fetchAllBookmarks();

    // Aggregate by domain
    const domainMap = new Map<string, { count: number; saves: number; maxId: number }>();

    for (const b of bookmarks) {
      if (!b.domain) continue;
      const existing = domainMap.get(b.domain);
      if (existing) {
        existing.count++;
        existing.saves += b.saves_count || 0;
        if (b.id > existing.maxId) existing.maxId = b.id;
      } else {
        domainMap.set(b.domain, {
          count: 1,
          saves: b.saves_count || 0,
          maxId: b.id,
        });
      }
    }

    // Convert to array and sort
    const domains = Array.from(domainMap.entries()).map(([domain, stats]) => ({
      domain,
      bookmark_count: stats.count,
      total_saves: stats.saves,
      maxId: stats.maxId,
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
