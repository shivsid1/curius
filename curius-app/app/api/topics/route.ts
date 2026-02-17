import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TAXONOMY, TAXONOMY_MIGRATION } from '@/lib/utils/taxonomy';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get topic counts with subtopic breakdown from database
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

    // Initialize counts for new taxonomy structure
    const newTopicCounts: Record<string, Record<string, number>> = {};
    for (const [category, data] of Object.entries(TAXONOMY)) {
      newTopicCounts[category] = {};
      for (const subcategory of data.subcategories) {
        newTopicCounts[category][subcategory] = 0;
      }
    }

    // Map old categories to new taxonomy and aggregate counts
    for (const row of topicCounts || []) {
      if (!row.topic) continue;

      let mapping = null;

      // First, try to match the subtopic (more specific)
      if (row.subtopic) {
        mapping = TAXONOMY_MIGRATION[row.subtopic];
      }

      // If not found, try the topic
      if (!mapping) {
        mapping = TAXONOMY_MIGRATION[row.topic];
      }

      // If still not found, use keyword matching
      if (!mapping) {
        const combined = `${row.topic} ${row.subtopic || ''}`.toLowerCase();

        if (combined.includes('ai') || combined.includes('machine learning') || combined.includes('llm') || combined.includes('gpt') || combined.includes('neural')) {
          mapping = { category: 'Tech', subcategory: 'AI & Machine Learning' };
        } else if (combined.includes('devops') || combined.includes('infrastructure') || combined.includes('cloud') || combined.includes('database') || combined.includes('security')) {
          mapping = { category: 'Tech', subcategory: 'Infrastructure' };
        } else if (combined.includes('developer tool') || combined.includes('ide') || combined.includes('editor')) {
          mapping = { category: 'Tech', subcategory: 'Developer Tools' };
        } else if (combined.includes('hardware')) {
          mapping = { category: 'Tech', subcategory: 'Hardware' };
        } else if (combined.includes('tech') || combined.includes('software') || combined.includes('programming') || combined.includes('web') || combined.includes('mobile') || combined.includes('code')) {
          mapping = { category: 'Tech', subcategory: 'Software Engineering' };
        } else if (combined.includes('bio') || combined.includes('neuro') || combined.includes('genetics')) {
          mapping = { category: 'Science', subcategory: 'Biology & Biotech' };
        } else if (combined.includes('physics') || combined.includes('math')) {
          mapping = { category: 'Science', subcategory: 'Physics & Math' };
        } else if (combined.includes('medicine') || combined.includes('health') || combined.includes('longevity')) {
          mapping = { category: 'Science', subcategory: 'Medicine & Health' };
        } else if (combined.includes('climate') || combined.includes('environment')) {
          mapping = { category: 'Science', subcategory: 'Climate & Environment' };
        } else if (combined.includes('space') || combined.includes('astro')) {
          mapping = { category: 'Science', subcategory: 'Space & Astronomy' };
        } else if (combined.includes('science') || combined.includes('research')) {
          mapping = { category: 'Science', subcategory: 'Biology & Biotech' };
        } else if (combined.includes('startup') || combined.includes('founder') || combined.includes('vc') || combined.includes('fundrais')) {
          mapping = { category: 'Business', subcategory: 'Startups' };
        } else if (combined.includes('management') || combined.includes('leadership') || combined.includes('marketing') || combined.includes('hiring')) {
          mapping = { category: 'Business', subcategory: 'Operations' };
        } else if (combined.includes('finance') || combined.includes('invest') || combined.includes('trading') || combined.includes('crypto')) {
          mapping = { category: 'Business', subcategory: 'Finance' };
        } else if (combined.includes('econom')) {
          mapping = { category: 'Business', subcategory: 'Economics' };
        } else if (combined.includes('business')) {
          mapping = { category: 'Business', subcategory: 'Operations' };
        } else if (combined.includes('philosoph') || combined.includes('ethics') || combined.includes('epistemolog')) {
          mapping = { category: 'Culture', subcategory: 'Philosophy' };
        } else if (combined.includes('art') || combined.includes('design') || combined.includes('ui') || combined.includes('ux') || combined.includes('visual')) {
          mapping = { category: 'Culture', subcategory: 'Art & Design' };
        } else if (combined.includes('history')) {
          mapping = { category: 'Culture', subcategory: 'History' };
        } else if (combined.includes('writing') || combined.includes('essay') || combined.includes('fiction') || combined.includes('journal') || combined.includes('literature')) {
          mapping = { category: 'Culture', subcategory: 'Writing' };
        } else if (combined.includes('politic') || combined.includes('society')) {
          mapping = { category: 'Culture', subcategory: 'Society & Politics' };
        } else if (combined.includes('culture')) {
          mapping = { category: 'Culture', subcategory: 'Philosophy' };
        } else if (combined.includes('career') || combined.includes('job') || combined.includes('remote work') || combined.includes('skill')) {
          mapping = { category: 'Life', subcategory: 'Career' };
        } else if (combined.includes('learn') || combined.includes('education') || combined.includes('course') || combined.includes('book')) {
          mapping = { category: 'Life', subcategory: 'Learning' };
        } else if (combined.includes('fitness') || combined.includes('mental health') || combined.includes('nutrition') || combined.includes('wellness')) {
          mapping = { category: 'Life', subcategory: 'Health' };
        } else if (combined.includes('productiv') || combined.includes('life advice')) {
          mapping = { category: 'Life', subcategory: 'Productivity' };
        } else if (combined.includes('entertain') || combined.includes('podcast') || combined.includes('video') || combined.includes('gaming') || combined.includes('sport') || combined.includes('media') || combined.includes('news')) {
          mapping = { category: 'Life', subcategory: 'Entertainment' };
        } else if (combined.includes('personal')) {
          mapping = { category: 'Life', subcategory: 'Productivity' };
        } else {
          // Default fallback
          mapping = { category: 'Life', subcategory: 'Learning' };
        }
      }

      // Increment the count
      if (newTopicCounts[mapping.category] && newTopicCounts[mapping.category][mapping.subcategory] !== undefined) {
        newTopicCounts[mapping.category][mapping.subcategory]++;
      }
    }

    // Convert to response format with TAXONOMY order
    const topics = Object.entries(TAXONOMY).map(([category, data]) => {
      const subtopics = data.subcategories
        .map((subcategory) => ({
          subtopic: subcategory,
          count: newTopicCounts[category][subcategory] || 0,
        }))
        .filter((s) => s.count > 0);

      const totalCount = subtopics.reduce((sum, s) => sum + s.count, 0);

      return {
        topic: category,
        icon: data.icon,
        description: data.description,
        count: totalCount,
        subtopics,
      };
    }).filter((t) => t.count > 0);

    return NextResponse.json({
      data: topics,
      total: topics.reduce((sum, t) => sum + t.count, 0),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
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
