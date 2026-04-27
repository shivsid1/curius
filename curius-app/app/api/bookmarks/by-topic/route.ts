import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;
function filterNonChinese<T extends { title?: string | null }>(items: T[]): T[] {
  return items.filter((item) => !item.title || !CHINESE_REGEX.test(item.title));
}

// Enrich bookmarks with first saver info via Postgres function
async function enrichWithFirstSaver<T extends { id: number }>(bookmarks: T[]): Promise<(T & { first_saved_at?: string; first_saved_by?: string })[]> {
  if (bookmarks.length === 0) return bookmarks;

  const ids = bookmarks.map(b => b.id);
  const { data: savers } = await supabase.rpc('get_first_savers', { bookmark_ids: ids });

  if (!savers || savers.length === 0) return bookmarks;

  type Saver = { bookmark_id: number; saved_at: string; username: string };
  const saverMap = new Map<number, Saver>(savers.map((s: Saver) => [s.bookmark_id, s]));

  return bookmarks.map(b => {
    const saver = saverMap.get(b.id);
    return saver
      ? { ...b, first_saved_at: saver.saved_at, first_saved_by: saver.username }
      : b;
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const topic = searchParams.get('topic');
    const subtopic = searchParams.get('subtopic');
    const sort = searchParams.get('sort') || 'recent'; // recent | popular | domain
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // No topic: return bookmarks with tags, sorted
    if (!topic) {
      // Inner join so untagged (newest, unclassified) bookmarks don't show up
      // first under sort=recent and leave the cards without category badges.
      let query = supabase
        .from('bookmarks')
        .select(`
          *,
          bookmark_tags_v2!inner (topic, subtopic)
        `, { count: 'exact' });

      if (sort === 'popular') {
        query = query.order('saves_count', { ascending: false }).order('id', { ascending: false });
      } else if (sort === 'domain') {
        query = query.order('domain', { ascending: true }).order('saves_count', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        console.error('Bookmarks query error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch bookmarks', details: error.message },
          { status: 500 }
        );
      }

      const enriched = await enrichWithFirstSaver(filterNonChinese(data || []));
      const totalPages = count ? Math.ceil(count / limit) : 0;
      return NextResponse.json({
        data: enriched,
        pagination: { page, limit, total: count || 0, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    // Query bookmark_tags_v2 directly -- DB topics are already clean
    let tagsQuery = supabase
      .from('bookmark_tags_v2')
      .select('bookmark_id')
      .eq('topic', topic);

    if (subtopic) {
      tagsQuery = tagsQuery.eq('subtopic', subtopic);
    }

    const { data: taggedBookmarkIds, error: tagsError } = await tagsQuery;

    if (tagsError) {
      console.error('Tags query error:', tagsError);
      return NextResponse.json(
        { error: 'Failed to fetch tags', details: tagsError.message },
        { status: 500 }
      );
    }

    if (!taggedBookmarkIds || taggedBookmarkIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        filters: { topic, subtopic },
      });
    }

    // Deduplicate and sort for consistent pagination
    const bookmarkIds = [...new Set(taggedBookmarkIds.map(t => t.bookmark_id))].sort((a, b) => b - a);
    const total = bookmarkIds.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedIds = bookmarkIds.slice(offset, offset + limit);

    let bookmarksQuery = supabase
      .from('bookmarks')
      .select(`
        *,
        bookmark_tags_v2 (topic, subtopic)
      `)
      .in('id', paginatedIds);

    if (sort === 'popular') {
      bookmarksQuery = bookmarksQuery.order('saves_count', { ascending: false }).order('id', { ascending: false });
    } else if (sort === 'domain') {
      bookmarksQuery = bookmarksQuery.order('domain', { ascending: true }).order('saves_count', { ascending: false });
    } else {
      bookmarksQuery = bookmarksQuery.order('created_at', { ascending: false }).order('id', { ascending: false });
    }

    const { data: bookmarks, error: bookmarksError } = await bookmarksQuery;

    if (bookmarksError) {
      console.error('Bookmarks query error:', bookmarksError);
      return NextResponse.json(
        { error: 'Failed to fetch bookmarks', details: bookmarksError.message },
        { status: 500 }
      );
    }

    const enriched = await enrichWithFirstSaver(filterNonChinese(bookmarks || []));
    return NextResponse.json({
      data: enriched,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      filters: { topic, subtopic },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
