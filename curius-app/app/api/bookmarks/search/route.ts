import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { clampPagination } from '@/lib/api-pagination';

export const dynamic = 'force-dynamic';

// Filter out titles containing Chinese characters
const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;
function filterNonChinese<T extends { title?: string | null }>(items: T[]): T[] {
  return items.filter((item) => !item.title || !CHINESE_REGEX.test(item.title));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const topic = searchParams.get('topic');
    const { page, limit } = clampPagination(searchParams, { defaultLimit: 50 });

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // If a topic filter is set, get the bookmark IDs tagged with that topic first
    let topicIds: number[] | null = null;
    if (topic) {
      const { data: tagged, error: tagsError } = await supabase
        .from('bookmark_tags_v2')
        .select('bookmark_id')
        .eq('topic', topic);

      if (tagsError) {
        console.error('Tags query error:', tagsError);
        return NextResponse.json(
          { error: 'Failed to fetch tags', details: tagsError.message },
          { status: 500 }
        );
      }

      topicIds = [...new Set((tagged || []).map(t => t.bookmark_id))];
      if (topicIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
          query,
        });
      }
    }

    // Search in title using full-text search
    let searchQuery = supabase
      .from('bookmarks')
      .select('*', { count: 'exact' })
      .textSearch('title', query, {
        type: 'websearch',
        config: 'english',
      });

    if (topicIds) {
      searchQuery = searchQuery.in('id', topicIds);
    }

    const { data, error, count } = await searchQuery
      .order('saves_count', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        { error: 'Search failed', details: error.message },
        { status: 500 }
      );
    }

    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({
      data: filterNonChinese(data || []),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      query,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
