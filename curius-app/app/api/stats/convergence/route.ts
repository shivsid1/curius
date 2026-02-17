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
    const days = parseInt(searchParams.get('days') || '7'); // Time window in days
    const domain = searchParams.get('domain');

    // Calculate offset and date threshold
    const offset = (page - 1) * limit;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    const dateStr = dateThreshold.toISOString();

    // Get bookmarks with recent saves using RPC or aggregation
    // First, get bookmark IDs with their recent save counts
    const { data: recentSaves, error: recentError } = await supabase
      .from('user_bookmarks')
      .select('bookmark_id')
      .gte('saved_at', dateStr);

    if (recentError) {
      console.error('Recent saves query error:', recentError);
      return NextResponse.json(
        { error: 'Failed to fetch recent saves', details: recentError.message },
        { status: 500 }
      );
    }

    // Count saves per bookmark
    const saveCounts: Record<number, number> = {};
    for (const save of recentSaves || []) {
      saveCounts[save.bookmark_id] = (saveCounts[save.bookmark_id] || 0) + 1;
    }

    // Filter to bookmarks with 2+ recent saves and sort by count
    const trendingIds = Object.entries(saveCounts)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id: parseInt(id), recentSaves: count }));

    const total = trendingIds.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedIds = trendingIds.slice(offset, offset + limit);

    if (paginatedIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        timeWindow: { days },
      });
    }

    // Fetch bookmark details
    let query = supabase
      .from('bookmarks')
      .select('*')
      .in('id', paginatedIds.map(p => p.id));

    if (domain) {
      query = query.ilike('domain', `%${domain}%`);
    }

    const { data: bookmarks, error: bookmarksError } = await query;

    if (bookmarksError) {
      console.error('Bookmarks query error:', bookmarksError);
      return NextResponse.json(
        { error: 'Failed to fetch bookmarks', details: bookmarksError.message },
        { status: 500 }
      );
    }

    // Create a map for quick lookup
    const bookmarkMap = new Map((bookmarks || []).map(b => [b.id, b]));

    // Build result in trending order (by recent saves)
    const convergenceData = filterNonChinese(
      paginatedIds
        .map(({ id, recentSaves }) => {
          const bookmark = bookmarkMap.get(id);
          if (!bookmark) return null;
          return {
            ...bookmark,
            recent_saves: recentSaves,
            convergence_score: recentSaves,
            saved_by_users: [],
          };
        })
        .filter(Boolean) as any[]
    );

    return NextResponse.json({
      data: convergenceData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      timeWindow: { days },
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
