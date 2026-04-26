import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Parallel queries for counts
    const [bookmarksResult, usersResult, tagsResult] = await Promise.all([
      supabase.from('bookmarks').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('bookmark_tags_v2').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      bookmarks: bookmarksResult.count ?? 0,
      users: usersResult.count ?? 0,
      tagged: tagsResult.count ?? 0,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (err) {
    console.error('Stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
