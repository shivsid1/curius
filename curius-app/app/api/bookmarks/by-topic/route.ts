import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Filter out titles containing Chinese characters
const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;
function filterNonChinese<T extends { title?: string | null }>(items: T[]): T[] {
  return items.filter((item) => !item.title || !CHINESE_REGEX.test(item.title));
}

// Reverse mapping: new taxonomy -> old database patterns to search
const SUBCATEGORY_TO_DB_PATTERNS: Record<string, { topics?: string[]; subtopics?: string[]; keywords?: string[] }> = {
  // Tech
  'AI & Machine Learning': {
    topics: ['AI/ML', 'Technology'],
    subtopics: ['AI & Machine Learning', 'LLMs & Language Models', 'Computer Vision', 'AI Research', 'AI Tools & APIs', 'AI Agents', 'AI Ethics & Safety'],
    keywords: ['ai', 'machine learning', 'llm', 'gpt', 'neural'],
  },
  'Software Engineering': {
    topics: ['Tech', 'Technology'],
    subtopics: ['Software Engineering', 'Web Development', 'Mobile Development', 'Programming Languages', 'Open Source'],
    keywords: ['software', 'programming', 'code', 'web', 'mobile'],
  },
  'Infrastructure': {
    topics: ['Tech', 'Technology'],
    subtopics: ['DevOps & Infrastructure', 'Databases', 'Security'],
    keywords: ['devops', 'infrastructure', 'cloud', 'database', 'security'],
  },
  'Hardware': {
    topics: ['Tech', 'Technology'],
    subtopics: ['Hardware', 'AI Hardware'],
  },
  'Developer Tools': {
    topics: ['Tech', 'Technology', 'Tools'],
    subtopics: ['Developer Tools'],
  },
  // Science
  'Biology & Biotech': {
    topics: ['Science'],
    subtopics: ['Biology & Biotech', 'Neuroscience', 'Research Papers'],
    keywords: ['bio', 'neuro', 'genetics'],
  },
  'Physics & Math': {
    topics: ['Science', 'Math'],
    subtopics: ['Physics', 'Physics & Math', 'Chemistry'],
  },
  'Medicine & Health': {
    topics: ['Science', 'Health'],
    subtopics: ['Medicine & Health', 'Medicine', 'Longevity'],
  },
  'Climate & Environment': {
    topics: ['Science'],
    subtopics: ['Climate & Environment'],
  },
  'Space & Astronomy': {
    topics: ['Science'],
    subtopics: ['Space & Astronomy'],
  },
  // Business
  'Startups': {
    topics: ['Startups', 'Business', 'Startups/Business'],
    subtopics: ['Startups & Founders', 'Fundraising & VC', 'Founder Stories', 'Strategy'],
  },
  'Operations': {
    topics: ['Business'],
    subtopics: ['Management & Leadership', 'Marketing & Growth', 'Hiring & Culture', 'Product Management'],
  },
  'Finance': {
    topics: ['Finance', 'Business'],
    subtopics: ['Investing & Finance', 'Investing', 'Markets & Trading', 'Personal Finance', 'Crypto & Web3'],
  },
  'Economics': {
    topics: ['Business', 'Finance'],
    subtopics: ['Economics'],
  },
  // Culture
  'Philosophy': {
    topics: ['Philosophy', 'Culture'],
    subtopics: ['Philosophy & Ideas', 'Ethics', 'Epistemology', 'Rationality', 'Politics', 'History of Ideas'],
  },
  'Art & Design': {
    topics: ['Design', 'Culture'],
    subtopics: ['Art & Design', 'Art', 'UI/UX Design', 'Visual Design', 'Design Systems', 'Typography', 'Branding'],
  },
  'History': {
    topics: ['Culture'],
    subtopics: ['History'],
  },
  'Writing': {
    topics: ['Writing', 'Culture'],
    subtopics: ['Essays & Opinion', 'Technical Writing', 'Fiction', 'Journalism', 'Newsletters', 'Books & Literature'],
  },
  'Society & Politics': {
    topics: ['Culture'],
    subtopics: ['Politics & Society', 'Society'],
  },
  // Life
  'Career': {
    topics: ['Career', 'Personal'],
    subtopics: ['Career & Skills', 'Job Hunting', 'Skill Development', 'Networking', 'Remote Work', 'Leadership'],
  },
  'Learning': {
    topics: ['Education', 'Personal'],
    subtopics: ['Learning & Education', 'Online Courses', 'Learning Methods', 'Research', 'Tutorials', 'Books & Reading'],
  },
  'Health': {
    topics: ['Health', 'Personal'],
    subtopics: ['Health & Fitness', 'Longevity', 'Fitness', 'Mental Health', 'Nutrition', 'Medicine'],
  },
  'Productivity': {
    topics: ['Personal', 'Tools'],
    subtopics: ['Productivity', 'Life Advice', 'Automation', 'Communication'],
  },
  'Entertainment': {
    topics: ['Media'],
    subtopics: ['Entertainment', 'Podcasts & Videos', 'Podcasts', 'Videos', 'News', 'News & Modern Events', 'Music', 'Games', 'Gaming', 'Sports'],
  },
};

// Map new category to old database topics
const CATEGORY_TO_DB_TOPICS: Record<string, string[]> = {
  'Tech': ['Technology', 'Tech', 'AI/ML', 'Tools'],
  'Science': ['Science', 'Math', 'Research'],
  'Business': ['Business', 'Startups', 'Finance', 'Startups/Business'],
  'Culture': ['Culture', 'Philosophy', 'Design', 'Writing'],
  'Life': ['Personal', 'Career', 'Education', 'Health', 'Media'],
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const topic = searchParams.get('topic');
    const subtopic = searchParams.get('subtopic');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Calculate offset
    const offset = (page - 1) * limit;

    // If no topic specified, return recent bookmarks with tags
    if (!topic) {
      const { data, error, count } = await supabase
        .from('bookmarks')
        .select(`
          *,
          bookmark_tags_v2 (topic, subtopic)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Bookmarks query error:', error);
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
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }

    // Query with topic filter using new taxonomy mapping
    let taggedBookmarkIds: { bookmark_id: number }[] = [];

    if (subtopic && SUBCATEGORY_TO_DB_PATTERNS[subtopic]) {
      // Query by specific subcategory - only match the subtopic names
      const patterns = SUBCATEGORY_TO_DB_PATTERNS[subtopic];

      if (patterns.subtopics && patterns.subtopics.length > 0) {
        const orConditions = patterns.subtopics.map(s => `subtopic.eq.${s}`).join(',');

        const { data, error } = await supabase
          .from('bookmark_tags_v2')
          .select('bookmark_id')
          .or(orConditions);

        if (error) {
          console.error('Tags query error:', error);
          return NextResponse.json(
            { error: 'Failed to fetch tags', details: error.message },
            { status: 500 }
          );
        }
        taggedBookmarkIds = data || [];
      }
    } else if (CATEGORY_TO_DB_TOPICS[topic]) {
      // Query by category (all subcategories under this category)
      const dbTopics = CATEGORY_TO_DB_TOPICS[topic];
      const orConditions = dbTopics.map(t => `topic.eq.${t}`).join(',');

      const { data, error } = await supabase
        .from('bookmark_tags_v2')
        .select('bookmark_id')
        .or(orConditions);

      if (error) {
        console.error('Tags query error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch tags', details: error.message },
          { status: 500 }
        );
      }
      taggedBookmarkIds = data || [];
    } else {
      // Fallback: try direct match on old schema
      let tagsQuery = supabase
        .from('bookmark_tags_v2')
        .select('bookmark_id')
        .eq('topic', topic);

      if (subtopic) {
        tagsQuery = tagsQuery.eq('subtopic', subtopic);
      }

      const { data, error } = await tagsQuery;

      if (error) {
        console.error('Tags query error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch tags', details: error.message },
          { status: 500 }
        );
      }
      taggedBookmarkIds = data || [];
    }

    if (!taggedBookmarkIds || taggedBookmarkIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        filters: { topic, subtopic },
      });
    }

    // Deduplicate and sort by ID descending for consistent pagination
    const bookmarkIds = [...new Set(taggedBookmarkIds.map(t => t.bookmark_id))].sort((a, b) => b - a);
    const total = bookmarkIds.length;
    const totalPages = Math.ceil(total / limit);

    // Get paginated bookmarks with their tags
    const paginatedIds = bookmarkIds.slice(offset, offset + limit);

    const { data: bookmarks, error: bookmarksError } = await supabase
      .from('bookmarks')
      .select(`
        *,
        bookmark_tags_v2 (topic, subtopic)
      `)
      .in('id', paginatedIds)
      .order('saves_count', { ascending: false })
      .order('id', { ascending: false });

    if (bookmarksError) {
      console.error('Bookmarks query error:', bookmarksError);
      return NextResponse.json(
        { error: 'Failed to fetch bookmarks', details: bookmarksError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: filterNonChinese(bookmarks || []),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: { topic, subtopic },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
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
