import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { TAXONOMY } from '@/lib/utils/taxonomy';

export const dynamic = 'force-dynamic';

// Tunables -----------------------------------------------------------------
const MIN_TOPICS = 3;
const MAX_TOPICS = 10;
const MAX_RESULTS = 5;
// Cap how many tagged bookmark IDs we pull when matching the selected
// topics. Keeps the candidate pool tractable without locking us out of
// large topic clusters.
const MAX_SEED_BOOKMARKS = 1500;
// Minimum overlap before a reader counts as a match candidate.
const MIN_MATCHES = 5;
// Floor on a reader's total saves, so we don't surface drive-by accounts.
const MIN_BOOKMARK_COUNT = 25;
// How many sample bookmarks to surface per matched reader.
const SAMPLE_BOOKMARK_COUNT = 4;

interface ByTasteRequest {
  topics?: unknown;
}

interface SampleBookmark {
  title: string | null;
  url: string;
  domain: string | null;
}

interface ReaderMatch {
  reader_no: number;
  bookmark_count: number;
  match_count: number;
  taste_fingerprint: Array<{ topic: string; percentage: number }> | null;
  sample_bookmarks: SampleBookmark[];
}

const ALL_TOP_LEVEL = new Set(Object.keys(TAXONOMY));
const ALL_SUBTOPICS = new Set(
  Object.values(TAXONOMY).flatMap((t) => t.subtopics as readonly string[])
);

function classifyTopic(name: string): { kind: 'topic' | 'subtopic' } | null {
  if (ALL_TOP_LEVEL.has(name)) return { kind: 'topic' };
  if (ALL_SUBTOPICS.has(name)) return { kind: 'subtopic' };
  return null;
}

export async function POST(request: NextRequest) {
  try {
    let body: ByTasteRequest;
    try {
      body = (await request.json()) as ByTasteRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const rawTopics = Array.isArray(body.topics) ? body.topics : null;
    if (!rawTopics) {
      return NextResponse.json(
        { error: '`topics` must be an array of topic names' },
        { status: 400 }
      );
    }

    const topics = Array.from(
      new Set(
        rawTopics
          .filter((t): t is string => typeof t === 'string')
          .map((t) => t.trim())
          .filter(Boolean)
      )
    );

    if (topics.length < MIN_TOPICS) {
      return NextResponse.json(
        { error: `Pick at least ${MIN_TOPICS} topics to find your twins` },
        { status: 400 }
      );
    }
    if (topics.length > MAX_TOPICS) {
      return NextResponse.json(
        { error: `Pick at most ${MAX_TOPICS} topics` },
        { status: 400 }
      );
    }

    const topLevel: string[] = [];
    const subtopicLevel: string[] = [];
    for (const t of topics) {
      const c = classifyTopic(t);
      if (!c) continue;
      if (c.kind === 'topic') topLevel.push(t);
      else subtopicLevel.push(t);
    }

    if (topLevel.length === 0 && subtopicLevel.length === 0) {
      return NextResponse.json(
        { error: 'None of the selected topics are recognised' },
        { status: 400 }
      );
    }

    // 1) Find bookmark IDs matching any of the selected topics.
    const seedIds = new Set<number>();
    const TAG_PAGE = 1000;

    async function pullTaggedIds(
      column: 'topic' | 'subtopic',
      values: string[]
    ): Promise<void> {
      if (values.length === 0) return;
      let offset = 0;
      while (seedIds.size < MAX_SEED_BOOKMARKS) {
        const { data, error } = await supabase
          .from('bookmark_tags_v2')
          .select('bookmark_id')
          .in(column, values)
          .range(offset, offset + TAG_PAGE - 1);
        if (error) {
          console.error(`Tag query error (${column}):`, error);
          return;
        }
        if (!data || data.length === 0) break;
        for (const row of data) {
          if (row.bookmark_id != null) seedIds.add(row.bookmark_id as number);
          if (seedIds.size >= MAX_SEED_BOOKMARKS) break;
        }
        if (data.length < TAG_PAGE) break;
        offset += TAG_PAGE;
      }
    }

    await pullTaggedIds('topic', topLevel);
    await pullTaggedIds('subtopic', subtopicLevel);

    if (seedIds.size === 0) {
      return NextResponse.json({
        topics_matched: topics,
        seed_bookmarks: 0,
        results: [] as ReaderMatch[],
      });
    }

    const seedBookmarkIds = Array.from(seedIds);

    // 2) Count saves per user for those bookmarks.
    const overlapCounts: Record<number, number> = {};
    let offset = 0;
    const BM_PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('user_bookmarks')
        .select('user_id')
        .in('bookmark_id', seedBookmarkIds)
        .range(offset, offset + BM_PAGE - 1);
      if (error) {
        console.error('user_bookmarks page error:', error);
        return NextResponse.json(
          { error: 'Failed to compute matches' },
          { status: 500 }
        );
      }
      if (!data || data.length === 0) break;
      for (const row of data) {
        const uid = row.user_id as number | null;
        if (uid != null) overlapCounts[uid] = (overlapCounts[uid] || 0) + 1;
      }
      if (data.length < BM_PAGE) break;
      offset += BM_PAGE;
      if (offset > 80_000) break;
    }

    const ranked = Object.entries(overlapCounts)
      .map(([id, count]) => ({ id: Number(id), match: count }))
      .filter((r) => r.match >= MIN_MATCHES)
      .sort((a, b) => b.match - a.match)
      .slice(0, MAX_RESULTS * 3); // headroom for the size filter below

    if (ranked.length === 0) {
      return NextResponse.json({
        topics_matched: topics,
        seed_bookmarks: seedBookmarkIds.length,
        results: [] as ReaderMatch[],
      });
    }

    // 3) Fetch pseudonymous identity for candidates. reader_no and the stored
    //    taste_fingerprint replace the old per-candidate live aggregation.
    //    No name fields are selected -- pseudonymity enforced at the query.
    const candidateIds = ranked.map((r) => r.id);
    const { data: candidateMeta, error: metaError } = await supabase
      .from('users')
      .select('id, reader_no, bookmark_count, taste_fingerprint')
      .in('id', candidateIds);

    if (metaError) {
      console.error('Candidate meta error:', metaError);
      return NextResponse.json(
        { error: 'Failed to load reader metadata' },
        { status: 500 }
      );
    }

    type Meta = {
      id: number;
      reader_no: number;
      bookmark_count: number;
      taste_fingerprint: Array<{ topic: string; percentage: number }> | null;
    };
    const metaById = new Map<number, Meta>(
      ((candidateMeta || []) as Meta[]).map((u) => [u.id, u])
    );

    const sized = ranked
      .map((r) => ({ ...r, meta: metaById.get(r.id) }))
      .filter((r): r is typeof r & { meta: Meta } =>
        !!r.meta && r.meta.bookmark_count >= MIN_BOOKMARK_COUNT
      )
      .slice(0, MAX_RESULTS);

    if (sized.length === 0) {
      return NextResponse.json({
        topics_matched: topics,
        seed_bookmarks: seedBookmarkIds.length,
        results: [] as ReaderMatch[],
      });
    }

    // 4) Sample bookmarks per matched reader: prefer saves inside the seed
    //    set (the user's selected topics), ranked by global popularity.
    const results: ReaderMatch[] = [];

    for (const candidate of sized) {
      const { data: ubRows } = await supabase
        .from('user_bookmarks')
        .select('bookmark_id')
        .eq('user_id', candidate.id)
        .order('saved_at', { ascending: false })
        .limit(800);

      const userBookmarkIds = (ubRows || [])
        .map((r) => r.bookmark_id as number)
        .filter((id): id is number => id != null);

      const overlapWithSeed = userBookmarkIds.filter((id) => seedIds.has(id));
      const sampleSourceIds =
        overlapWithSeed.length > 0 ? overlapWithSeed : userBookmarkIds.slice(0, 200);

      const { data: sampleBookmarks } = await supabase
        .from('bookmarks')
        .select('id, title, link, domain, saves_count')
        .in('id', sampleSourceIds.slice(0, 200))
        .order('saves_count', { ascending: false })
        .limit(SAMPLE_BOOKMARK_COUNT);

      results.push({
        reader_no: candidate.meta.reader_no,
        bookmark_count: candidate.meta.bookmark_count,
        match_count: candidate.match,
        taste_fingerprint: candidate.meta.taste_fingerprint,
        sample_bookmarks: (sampleBookmarks || []).map((b) => ({
          title: (b.title as string | null) || null,
          url: b.link as string,
          domain: (b.domain as string | null) || null,
        })),
      });
    }

    return NextResponse.json(
      {
        topics_matched: topics,
        seed_bookmarks: seedBookmarkIds.length,
        results,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      }
    );
  } catch (err) {
    console.error('by-taste error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
