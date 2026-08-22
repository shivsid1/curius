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
// large topic clusters. We sample from the most popular bookmarks first.
const MAX_SEED_BOOKMARKS = 1500;
// Minimum overlap before a curator counts as a "cluster" candidate.
const MIN_CLUSTER_MATCHES = 5;
// How many candidate users to enrich with full topic + sample data.
const MAX_CANDIDATES_TO_ENRICH = 12;
// How many sample bookmarks to surface per cluster.
const SAMPLE_BOOKMARK_COUNT = 4;
// Floor on a curator's total saves, so we don't surface drive-by accounts.
const MIN_BOOKMARK_COUNT = 25;

interface ByTasteRequest {
  topics?: unknown;
}

interface ClusterTopic {
  topic: string;
  percentage: number;
}

interface SampleBookmark {
  title: string | null;
  url: string;
  domain: string | null;
}

interface ClusterResponse {
  cluster_id: number;
  bookmark_count: number;
  match_count: number;
  top_topics: ClusterTopic[];
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
        { error: `Pick at least ${MIN_TOPICS} topics to find a cluster` },
        { status: 400 }
      );
    }
    if (topics.length > MAX_TOPICS) {
      return NextResponse.json(
        { error: `Pick at most ${MAX_TOPICS} topics` },
        { status: 400 }
      );
    }

    // Split into top-level and subtopic buckets so we can build a clean OR
    // query against bookmark_tags_v2 (instead of a giant string).
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
    //    We pull the most popular tagged bookmarks first to bias toward
    //    the canon of each topic and avoid long-tail noise.
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
        results: [] as ClusterResponse[],
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
          { error: 'Failed to compute clusters' },
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
      .filter((r) => r.match >= MIN_CLUSTER_MATCHES)
      .sort((a, b) => b.match - a.match)
      .slice(0, MAX_CANDIDATES_TO_ENRICH);

    if (ranked.length === 0) {
      return NextResponse.json({
        topics_matched: topics,
        seed_bookmarks: seedBookmarkIds.length,
        results: [] as ClusterResponse[],
      });
    }

    // 3) Filter out tiny accounts using bookmark_count from `users`.
    const candidateIds = ranked.map((r) => r.id);
    const { data: candidateMeta, error: metaError } = await supabase
      .from('users')
      .select('id, bookmark_count')
      .in('id', candidateIds);

    if (metaError) {
      console.error('Candidate meta error:', metaError);
      return NextResponse.json(
        { error: 'Failed to load curator metadata' },
        { status: 500 }
      );
    }

    const metaById = new Map<number, number>(
      (candidateMeta || []).map((u) => [u.id as number, (u.bookmark_count as number) || 0])
    );

    const sized = ranked
      .map((r) => ({
        id: r.id,
        match: r.match,
        bookmark_count: metaById.get(r.id) || 0,
      }))
      .filter((r) => r.bookmark_count >= MIN_BOOKMARK_COUNT)
      .slice(0, MAX_RESULTS);

    if (sized.length === 0) {
      return NextResponse.json({
        topics_matched: topics,
        seed_bookmarks: seedBookmarkIds.length,
        results: [] as ClusterResponse[],
      });
    }

    // 4) Per-cluster enrichment: fetch each curator's bookmarks (capped),
    //    join through bookmark_tags_v2 for topic distribution, and pick
    //    sample bookmarks ranked by saves_count and topic alignment.
    const clusters: ClusterResponse[] = [];

    const seedSet = seedIds; // for fast lookup inside the loop
    let clusterIndex = 0;

    for (const candidate of sized) {
      clusterIndex += 1;

      // a) Pull this curator's bookmark IDs (capped — power-users have
      //    thousands and we don't need them all to estimate distribution).
      const { data: ubRows } = await supabase
        .from('user_bookmarks')
        .select('bookmark_id')
        .eq('user_id', candidate.id)
        .order('saved_at', { ascending: false })
        .limit(800);

      const userBookmarkIds = (ubRows || [])
        .map((r) => r.bookmark_id as number)
        .filter((id): id is number => id != null);

      if (userBookmarkIds.length === 0) continue;

      // b) Topic distribution across those bookmarks.
      const topicCounts: Record<string, number> = {};
      let totalTagged = 0;
      let tagOffset = 0;
      while (true) {
        const { data: tagPage } = await supabase
          .from('bookmark_tags_v2')
          .select('topic')
          .in('bookmark_id', userBookmarkIds)
          .range(tagOffset, tagOffset + TAG_PAGE - 1);
        if (!tagPage || tagPage.length === 0) break;
        for (const row of tagPage) {
          const t = row.topic as string | null;
          if (!t) continue;
          topicCounts[t] = (topicCounts[t] || 0) + 1;
          totalTagged += 1;
        }
        if (tagPage.length < TAG_PAGE) break;
        tagOffset += TAG_PAGE;
        if (tagOffset > 5000) break;
      }

      const topTopics: ClusterTopic[] =
        totalTagged > 0
          ? Object.entries(topicCounts)
              .map(([topic, count]) => ({
                topic,
                percentage: Math.round((count / totalTagged) * 1000) / 10,
              }))
              .sort((a, b) => b.percentage - a.percentage)
              .slice(0, 3)
          : [];

      // c) Sample bookmarks: prefer ones inside the seed set (the user's
      //    actual selected topics) and ranked by global saves_count.
      const overlapWithSeed = userBookmarkIds.filter((id) => seedSet.has(id));
      const sampleSourceIds =
        overlapWithSeed.length > 0 ? overlapWithSeed : userBookmarkIds.slice(0, 200);

      const { data: sampleBookmarks } = await supabase
        .from('bookmarks')
        .select('id, title, link, domain, saves_count')
        .in('id', sampleSourceIds.slice(0, 200))
        .order('saves_count', { ascending: false })
        .limit(SAMPLE_BOOKMARK_COUNT);

      const sample: SampleBookmark[] = (sampleBookmarks || []).map((b) => ({
        title: (b.title as string | null) || null,
        url: b.link as string,
        domain: (b.domain as string | null) || null,
      }));

      clusters.push({
        cluster_id: clusterIndex,
        bookmark_count: candidate.bookmark_count,
        match_count: candidate.match,
        top_topics: topTopics,
        sample_bookmarks: sample,
      });
    }

    return NextResponse.json(
      {
        topics_matched: topics,
        seed_bookmarks: seedBookmarkIds.length,
        results: clusters,
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
