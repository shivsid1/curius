import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Filter out titles containing Chinese characters
const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const minSaves = parseInt(searchParams.get('minSaves') || '2');
    const topic = searchParams.get('topic');

    // Get total count for random offset
    let countQuery = supabase
      .from('bookmarks')
      .select('id', { count: 'exact', head: true })
      .gte('saves_count', minSaves);

    const { count, error: countError } = await countQuery;

    if (countError || !count || count === 0) {
      return NextResponse.json(
        { error: 'No bookmarks found' },
        { status: 404 }
      );
    }

    // Generate random offset
    const randomOffset = Math.floor(Math.random() * count);

    // Fetch random bookmark
    let query = supabase
      .from('bookmarks')
      .select('*')
      .gte('saves_count', minSaves)
      .range(randomOffset, randomOffset);

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch random bookmark' },
        { status: 500 }
      );
    }

    let bookmark = data[0];

    // If Chinese title, try a few more times
    let attempts = 0;
    while (bookmark.title && CHINESE_REGEX.test(bookmark.title) && attempts < 5) {
      const newOffset = Math.floor(Math.random() * count);
      const { data: retryData } = await supabase
        .from('bookmarks')
        .select('*')
        .gte('saves_count', minSaves)
        .range(newOffset, newOffset);

      if (retryData && retryData.length > 0) {
        bookmark = retryData[0];
      }
      attempts++;
    }

    return NextResponse.json({
      data: bookmark,
      meta: {
        totalPool: count,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store',
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
