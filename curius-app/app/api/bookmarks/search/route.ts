import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Search in title using full-text search
    const { data, error, count } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact' })
      .textSearch('title', query, {
        type: 'websearch',
        config: 'english',
      })
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
