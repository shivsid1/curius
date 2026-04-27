import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MIN_SHARED = 3;
const MAX_RESULTS = 20;
const MAX_SEED_BOOKMARKS = 500;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const { data: inputUser, error: userErr } = await supabase
      .from('users')
      .select('id, username, display_name, bookmark_count')
      .ilike('username', cleanUsername)
      .maybeSingle();

    if (userErr) {
      console.error('User lookup error:', userErr);
      return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 });
    }

    if (!inputUser) {
      return NextResponse.json(
        { error: 'No Curius user found with that username', username: cleanUsername },
        { status: 404 }
      );
    }

    // Get this user's saved bookmark IDs (capped to keep the join tractable
    // for power-users with thousands of saves).
    const { data: myBookmarks } = await supabase
      .from('user_bookmarks')
      .select('bookmark_id')
      .eq('user_id', inputUser.id)
      .order('saved_at', { ascending: false })
      .limit(MAX_SEED_BOOKMARKS);

    const myBookmarkIds = (myBookmarks || []).map((b) => b.bookmark_id);

    if (myBookmarkIds.length === 0) {
      return NextResponse.json({
        user: inputUser,
        seedBookmarks: 0,
        results: [],
      });
    }

    // Pull all (user_id, bookmark_id) overlaps from other users.
    // Supabase caps responses at 1000 rows by default; paginate.
    const overlapCounts: Record<number, number> = {};
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data: page } = await supabase
        .from('user_bookmarks')
        .select('user_id')
        .in('bookmark_id', myBookmarkIds)
        .neq('user_id', inputUser.id)
        .range(offset, offset + pageSize - 1);

      if (!page || page.length === 0) break;
      for (const row of page) {
        overlapCounts[row.user_id] = (overlapCounts[row.user_id] || 0) + 1;
      }
      if (page.length < pageSize) break;
      offset += pageSize;
      if (offset > 50_000) break; // hard cap to keep request bounded
    }

    const ranked = Object.entries(overlapCounts)
      .map(([id, count]) => ({ id: Number(id), shared: count }))
      .filter((r) => r.shared >= MIN_SHARED)
      .sort((a, b) => b.shared - a.shared)
      .slice(0, MAX_RESULTS);

    if (ranked.length === 0) {
      return NextResponse.json({
        user: inputUser,
        seedBookmarks: myBookmarkIds.length,
        results: [],
      });
    }

    const { data: candidates } = await supabase
      .from('users')
      .select('id, username, display_name, profile_url, bookmark_count, last_online')
      .in('id', ranked.map((r) => r.id));

    const byId = new Map((candidates || []).map((u) => [u.id, u]));
    const results = ranked
      .map((r) => {
        const u = byId.get(r.id);
        if (!u) return null;
        return {
          ...u,
          shared_bookmarks: r.shared,
          // Lightweight Jaccard-like score: shared / sqrt(my * their)
          // Penalises mass-savers and self-promoters.
          affinity:
            u.bookmark_count && u.bookmark_count > 0
              ? r.shared / Math.sqrt(myBookmarkIds.length * u.bookmark_count)
              : 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({
      user: inputUser,
      seedBookmarks: myBookmarkIds.length,
      results,
    });
  } catch (err) {
    console.error('Similar users error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
