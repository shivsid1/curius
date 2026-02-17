import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    username: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params;

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const includeBookmarks = searchParams.get('includeBookmarks') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Fetch user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      console.error('User fetch error:', userError);
      return NextResponse.json(
        { error: 'Failed to fetch user', details: userError.message },
        { status: 500 }
      );
    }

    // If bookmarks requested, fetch them
    let bookmarks = null;
    let bookmarksPagination = null;

    if (includeBookmarks) {
      const offset = (page - 1) * limit;

      const { data: bookmarksData, error: bookmarksError, count } = await supabase
        .from('user_bookmarks')
        .select(`
          saved_at,
          page_number,
          discovered_from,
          bookmarks:bookmark_id (
            id,
            url,
            title,
            domain,
            saves_count
          )
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (bookmarksError) {
        console.error('Bookmarks fetch error:', bookmarksError);
        return NextResponse.json(
          { error: 'Failed to fetch user bookmarks', details: bookmarksError.message },
          { status: 500 }
        );
      }

      // Transform the data
      bookmarks = bookmarksData?.map((ub: any) => ({
        ...ub.bookmarks,
        saved_at: ub.saved_at,
        page_number: ub.page_number,
        discovered_from: ub.discovered_from,
      })) || [];

      const totalPages = count ? Math.ceil(count / limit) : 0;
      bookmarksPagination = {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    }

    return NextResponse.json({
      user,
      bookmarks,
      pagination: bookmarksPagination,
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
