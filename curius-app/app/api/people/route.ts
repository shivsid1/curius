import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { clampPagination } from '@/lib/api-pagination';

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const { page, limit } = clampPagination(searchParams, { defaultLimit: 30 });
    const sort = searchParams.get('sort') || 'active';

    const offset = (page - 1) * limit;

    // Determine sort field
    // Note: 'recent' and 'newest' both use created_at since last_online isn't tracked
    let sortField = 'bookmark_count';
    if (sort === 'recent' || sort === 'newest') sortField = 'created_at';

    // Query users with bookmarks
    const { data: users, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gt('bookmark_count', 0)
      .order(sortField, { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch people', details: error.message },
        { status: 500 }
      );
    }

    const totalPages = count ? Math.ceil(count / limit) : 0;

    // For paginated users, compute top topics via user_bookmarks -> bookmark_tags_v2
    const enrichedUsers = (users || []).map((u) => ({
      ...u,
      top_topics: [] as Array<{ topic: string; count: number }>,
    }));

    if (enrichedUsers.length > 0) {
      const userIds = enrichedUsers.map((u) => u.id);

      // Get bookmark IDs for these users -- sample up to 200 per user for topic signal
      const { data: userBookmarks } = await supabase
        .from('user_bookmarks')
        .select('user_id, bookmark_id')
        .in('user_id', userIds)
        .limit(5000);

      if (userBookmarks && userBookmarks.length > 0) {
        const bookmarkIds = [...new Set(userBookmarks.map((ub) => ub.bookmark_id))];
        const bookmarkToUsers = new Map<number, number[]>();
        for (const ub of userBookmarks) {
          if (!bookmarkToUsers.has(ub.bookmark_id)) {
            bookmarkToUsers.set(ub.bookmark_id, []);
          }
          bookmarkToUsers.get(ub.bookmark_id)!.push(ub.user_id);
        }

        // Fetch tags in batches to avoid URL length limits
        const tags = await fetchTagsInBatches(bookmarkIds);

        if (tags.length > 0) {
          const userTopics = new Map<number, Map<string, number>>();

          for (const tag of tags) {
            const ownerIds = bookmarkToUsers.get(tag.bookmark_id);
            if (!ownerIds) continue;

            for (const userId of ownerIds) {
              if (!userTopics.has(userId)) {
                userTopics.set(userId, new Map());
              }
              const topicMap = userTopics.get(userId)!;
              topicMap.set(tag.topic, (topicMap.get(tag.topic) || 0) + 1);
            }
          }

          for (const u of enrichedUsers) {
            const topicMap = userTopics.get(u.id);
            if (topicMap) {
              u.top_topics = Array.from(topicMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([topic, count]) => ({ topic, count }));
            }
          }
        }
      }
    }

    return NextResponse.json(
      {
        data: enrichedUsers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
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
