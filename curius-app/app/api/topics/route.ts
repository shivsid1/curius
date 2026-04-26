import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TAXONOMY } from '@/lib/utils/taxonomy';

export const revalidate = 3600;

export async function GET() {
  try {
    // Get all topic/subtopic pairs from DB
    const { data: topicCounts, error: topicError } = await supabase
      .from('bookmark_tags_v2')
      .select('topic, subtopic')
      .not('topic', 'is', null);

    if (topicError) {
      console.error('Topics query error:', topicError);
      return NextResponse.json(
        { error: 'Failed to fetch topics', details: topicError.message },
        { status: 500 }
      );
    }

    // Count per topic/subtopic -- DB data is already clean and matches TAXONOMY
    const counts: Record<string, Record<string, number>> = {};
    for (const [category, data] of Object.entries(TAXONOMY)) {
      counts[category] = {};
      for (const subtopic of data.subtopics) {
        counts[category][subtopic] = 0;
      }
    }

    for (const row of topicCounts || []) {
      if (!row.topic) continue;
      if (counts[row.topic] && row.subtopic && counts[row.topic][row.subtopic] !== undefined) {
        counts[row.topic][row.subtopic]++;
      }
    }

    // Build response in TAXONOMY order
    const topics = Object.entries(TAXONOMY).map(([category, data]) => {
      const subtopics = data.subtopics
        .map((subtopic) => ({
          subtopic,
          count: counts[category][subtopic] || 0,
        }))
        .filter((s) => s.count > 0);

      const totalCount = subtopics.reduce((sum, s) => sum + s.count, 0);

      return {
        topic: category,
        description: data.description,
        color: data.color,
        count: totalCount,
        subtopics,
      };
    }).filter((t) => t.count > 0);

    return NextResponse.json({
      data: topics,
      total: topics.reduce((sum, t) => sum + t.count, 0),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
