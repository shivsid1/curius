'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { ArrowRight, Check, Loader2, Sparkles, Users } from 'lucide-react';
import { useTopics, useReaderDirectory, useInfiniteScroll } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { ReaderCard } from '@/components/readers/ReaderCard';
import { ReaderGridSkeleton } from '@/components/readers/ReaderSkeleton';
import { TasteFingerprint } from '@/components/readers/TasteFingerprint';
import { Ornament } from '@/components/shared/Ornament';
import type { ReaderMatch, TasteFingerprintEntry } from '@/lib/supabase';

const MIN_TOPICS = 3;
const MAX_TOPICS = 10;

type Mode = 'username' | 'topics';

interface SimilarResponse {
  reader: {
    reader_no: number;
    bookmark_count: number;
    taste_fingerprint: TasteFingerprintEntry[] | null;
  };
  seedBookmarks: number;
  results: ReaderMatch[];
}

interface ByTasteResponse {
  topics_matched: string[];
  seed_bookmarks: number;
  results: ReaderMatch[];
}

export default function ReadersPage() {
  const [mode, setMode] = useState<Mode>('username');

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero: find your twins */}
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ink-light" />
            Find your twins
          </h1>
          <p className="font-scholarly text-sm text-ink-muted max-w-xl">
            Every reader here is anonymous but persistent — a catalogue number, a
            taste, a shelf. Find the ones who read like you.
          </p>
        </div>
        <Image
          src="/illustrations/scholar.png"
          alt=""
          width={96}
          height={96}
          className="opacity-60 shrink-0 hidden md:block"
        />
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1.5 mb-6">
        <button
          type="button"
          onClick={() => setMode('username')}
          className={cn(
            'px-3 py-1.5 rounded-md font-terminal text-xs border transition-colors',
            mode === 'username'
              ? 'bg-ink text-cream border-ink'
              : 'bg-cream text-ink border-border hover:border-ink/60'
          )}
        >
          I&apos;m on Curius
        </button>
        <button
          type="button"
          onClick={() => setMode('topics')}
          className={cn(
            'px-3 py-1.5 rounded-md font-terminal text-xs border transition-colors',
            mode === 'topics'
              ? 'bg-ink text-cream border-ink'
              : 'bg-cream text-ink border-border hover:border-ink/60'
          )}
        >
          Match me by topics
        </button>
      </div>

      {mode === 'username' ? <UsernameTwinFinder /> : <TopicTwinFinder />}

      <Ornament variant="divider" className="my-12" />

      <ReadingRoom />
    </div>
  );
}

// --- Mode 1: username self-lookup ------------------------------------------

function UsernameTwinFinder() {
  const [username, setUsername] = useState('');
  const [data, setData] = useState<SimilarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!clean || loading) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(clean)}/similar`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Something went wrong');
      } else {
        setData(body as SimilarResponse);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <p className="font-terminal text-xs uppercase tracking-wider text-ink-muted mb-3">
        Enter your Curius username &middot; your matches are computed from what you actually save
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-md mb-6">
        <span className="font-terminal text-sm text-ink-muted shrink-0">curius.app/</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your-username"
          className="flex-1 bg-cream border-b border-cream-border px-2 py-2 font-terminal text-sm text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-ink-light transition-colors"
        />
        <button
          type="submit"
          disabled={!username.trim() || loading}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-md font-terminal text-sm transition-colors',
            username.trim() && !loading
              ? 'bg-ink text-cream hover:bg-ink-light'
              : 'bg-cream-dark text-ink-muted cursor-not-allowed'
          )}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Find'}
          {!loading && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </form>

      {error && (
        <div className="border border-border rounded-md p-4 bg-cream-dark/30 mb-6">
          <p className="font-serif text-sm text-ink">{error}</p>
        </div>
      )}

      {data && (
        <div>
          {/* Your own catalogue entry */}
          <div className="frame-engraved rounded-lg bg-cream-dark/30 p-4 mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-terminal text-[10px] uppercase tracking-wider text-ink-muted mb-1">
                Your catalogue entry
              </p>
              <p className="font-cartographic text-base text-ink tracking-widest">
                READER N&ordm; {data.reader.reader_no}
              </p>
              <p className="font-terminal text-xs text-ink-muted mt-1">
                {data.reader.bookmark_count.toLocaleString()} bookmarks
                {' · '}matched from your {data.seedBookmarks.toLocaleString()} most recent saves
              </p>
            </div>
            <TasteFingerprint
              fingerprint={data.reader.taste_fingerprint}
              size="sm"
              className="w-48"
            />
          </div>

          {data.results.length === 0 ? (
            <div className="border border-border rounded-md p-6 bg-cream-dark/30">
              <p className="font-serif text-sm text-ink">
                No readers share enough of your shelf yet.
              </p>
              <p className="font-terminal text-xs text-ink-muted mt-1">
                Twins need at least 3 bookmarks in common. Save more, return later.
              </p>
            </div>
          ) : (
            <>
              <p className="font-terminal text-xs uppercase tracking-wider text-ink-muted mb-4">
                {data.results.length} reader{data.results.length === 1 ? '' : 's'} with overlapping taste
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.results.map((r) => (
                  <ReaderCard
                    key={r.reader_no}
                    reader={r}
                    matchLabel={
                      typeof r.shared_bookmarks === 'number'
                        ? `${r.shared_bookmarks} in common`
                        : undefined
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// --- Mode 2: topic picker ----------------------------------------------------

function TopicTwinFinder() {
  const { topics, isLoading: topicsLoading, error: topicsError } = useTopics();
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<ByTasteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = selected.length >= MIN_TOPICS && !loading;

  const toggle = (label: string) => {
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((p) => p !== label);
      if (prev.length >= MAX_TOPICS) return prev;
      return [...prev, label];
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch('/api/twin/by-taste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: selected }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Something went wrong');
      } else {
        setData(body as ByTasteResponse);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      {!data && (
        <>
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-terminal text-xs uppercase tracking-wider text-ink-muted">
              Pick {MIN_TOPICS}&ndash;{MAX_TOPICS} topics that pull you in
            </p>
            <p className="font-terminal text-xs text-ink-muted">
              {selected.length} / {MAX_TOPICS} selected
            </p>
          </div>

          {topicsLoading && (
            <p className="font-terminal text-sm text-ink-muted">Loading taxonomy&hellip;</p>
          )}
          {topicsError && (
            <p className="font-terminal text-sm text-red-700">{topicsError}</p>
          )}

          {!topicsLoading && !topicsError && (
            <div className="space-y-5">
              {topics.map((topicGroup) => (
                <div key={topicGroup.topic}>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => toggle(topicGroup.topic)}
                      className="inline-flex items-center gap-2 font-serif text-base font-semibold text-ink hover:text-ink-light transition-colors"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'inline-block w-2 h-2 rounded-full transition-opacity',
                          selected.includes(topicGroup.topic) ? 'opacity-100' : 'opacity-30'
                        )}
                        style={{ backgroundColor: topicGroup.color }}
                      />
                      {topicGroup.topic}
                      {selected.includes(topicGroup.topic) && (
                        <Check className="w-3.5 h-3.5 text-ink" />
                      )}
                    </button>
                    <span className="font-terminal text-[10px] uppercase tracking-wider text-ink-muted">
                      {topicGroup.count.toLocaleString()} saves
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {topicGroup.subtopics.map((s) => {
                      const active = selected.includes(s.subtopic);
                      const disabled = !active && selected.length >= MAX_TOPICS;
                      return (
                        <button
                          key={`${topicGroup.topic}-${s.subtopic}`}
                          type="button"
                          onClick={() => toggle(s.subtopic)}
                          disabled={disabled}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-terminal text-xs border transition-colors',
                            active
                              ? 'bg-ink text-cream border-ink'
                              : disabled
                              ? 'bg-cream-dark/40 text-ink-muted/60 border-border/40 cursor-not-allowed'
                              : 'bg-cream text-ink border-border hover:border-ink/60'
                          )}
                        >
                          {s.subtopic}
                          <span className="text-[10px] opacity-60">{s.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-md font-terminal text-sm transition-colors',
                canSubmit
                  ? 'bg-ink text-cream hover:bg-ink-light'
                  : 'bg-cream-dark text-ink-muted cursor-not-allowed'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Finding readers&hellip;
                </>
              ) : (
                <>
                  Find readers like me
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            {selected.length > 0 && !loading && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="font-terminal text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline"
              >
                Clear selection
              </button>
            )}
            {selected.length < MIN_TOPICS && (
              <p className="font-terminal text-xs text-ink-muted">
                Pick at least {MIN_TOPICS} to continue.
              </p>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="border border-border rounded-md p-4 bg-cream-dark/30 my-6">
          <p className="font-serif text-sm text-ink">{error}</p>
        </div>
      )}

      {data && (
        <div>
          <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
            <p className="font-terminal text-xs text-ink-muted uppercase tracking-wider">
              {data.results.length} reader{data.results.length === 1 ? '' : 's'} matched
              {' · '}seeded from {data.seed_bookmarks.toLocaleString()} bookmarks in your topics
            </p>
            <button
              type="button"
              onClick={() => {
                setData(null);
                setSelected([]);
              }}
              className="font-terminal text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline"
            >
              Pick different topics
            </button>
          </div>

          {data.results.length === 0 ? (
            <div className="border border-border rounded-md p-6 bg-cream-dark/30">
              <p className="font-serif text-sm text-ink">
                No readers lined up tightly with that mix.
              </p>
              <p className="font-terminal text-xs text-ink-muted mt-1">
                Try swapping in a more specific subtopic, or broadening to a top-level topic.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.results.map((r) => (
                <ReaderCard
                  key={r.reader_no}
                  reader={r}
                  matchLabel={
                    typeof r.match_count === 'number'
                      ? `${r.match_count} in your topics`
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// --- The reading room: directory of notable readers -------------------------

function ReadingRoom() {
  const [sort, setSort] = useState<'active' | 'shelf_size'>('active');
  const { readers, pagination, isLoading, isLoadingMore, hasMore, loadMore } =
    useReaderDirectory(sort);

  const sentinelRef = useInfiniteScroll(loadMore, {
    hasMore,
    isLoading: isLoading || isLoadingMore,
  });

  return (
    <section>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-2">
        <div>
          <h2 className="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <Users className="w-4 h-4 text-ink-light" />
            The reading room
          </h2>
          <p className="font-scholarly text-sm text-ink-muted">
            Readers with substantial shelves, catalogued by taste. Wander in.
          </p>
        </div>
        {pagination && (
          <span className="font-terminal text-xs text-ink-muted">
            {pagination.total.toLocaleString()} readers
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-5">
        <button
          type="button"
          onClick={() => setSort('active')}
          className={cn(
            'px-2.5 py-1 rounded-md font-terminal text-xs border transition-colors',
            sort === 'active'
              ? 'bg-ink text-cream border-ink'
              : 'bg-cream text-ink border-border hover:border-ink/60'
          )}
        >
          Recently active
        </button>
        <button
          type="button"
          onClick={() => setSort('shelf_size')}
          className={cn(
            'px-2.5 py-1 rounded-md font-terminal text-xs border transition-colors',
            sort === 'shelf_size'
              ? 'bg-ink text-cream border-ink'
              : 'bg-cream text-ink border-border hover:border-ink/60'
          )}
        >
          Largest shelves
        </button>
      </div>

      {isLoading && readers.length === 0 ? (
        <ReaderGridSkeleton count={6} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readers.map((r) => (
              <ReaderCard key={r.reader_no} reader={r} />
            ))}
          </div>

          {isLoadingMore && (
            <div className="py-4 text-center">
              <span className="font-terminal text-xs text-ink-muted">Loading more…</span>
            </div>
          )}

          <div ref={sentinelRef} className="h-10 flex items-center justify-center" aria-hidden="true">
            {hasMore && !isLoadingMore && (
              <span className="font-terminal text-xs text-ink-muted">Scroll for more…</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
