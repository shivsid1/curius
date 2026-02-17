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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const sortBy = searchParams.get('sortBy') || 'saves_count';
    const order = searchParams.get('order') || 'desc';
    const domain = searchParams.get('domain');

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('bookmarks')
      .select('*', { count: 'exact' });

    // Filter by domain if specified
    if (domain) {
      query = query.eq('domain', domain);
    }

    // Sort
    const validSortFields = ['saves_count', 'created_at', 'title', 'domain'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'saves_count';
    const ascending = order === 'asc';

    query = query.order(sortField, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bookmarks', details: error.message },
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
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
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
