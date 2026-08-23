'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useTopics } from '@/lib/hooks';
import { cn } from '@/lib/utils';

interface ClusterTopic {
  topic: string;
  percentage: number;
}

interface SampleBookmark {
  title: string | null;
  url: string;
  domain: string | null;
}

interface ClusterResult {
  cluster_id: number;
  bookmark_count: number;
  match_count: number;
  top_topics: ClusterTopic[];
  sample_bookmarks: SampleBookmark[];
}

interface ByTasteResponse {
  topics_matched: string[];
  seed_bookmarks: number;
  results: ClusterResult[];
}

const MIN_TOPICS = 3;
const MAX_TOPICS = 10;

// A-Z labels keep the cluster names neutral and obviously anonymous.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function clusterLabel(idx: number): string {
  return `Curator ${ALPHABET[idx % 26]}`;
}

export default function TwinPage() {
  const { topics, isLoading: topicsLoading, error: topicsError } = useTopics();
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<ByTasteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalSelectable = selected.length;
  const canSubmit = totalSelectable >= MIN_TOPICS && !loading;

  const toggle = (label: string) => {
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((p) => p !== label);
      if (prev.length >= MAX_TOPICS) return prev;
      return [...prev, label];
    });
  };

  const reset = () => {
    setData(null);
    setError(null);
    setSelected([]);
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
      const body = (await res.json()) as ByTasteResponse | { error?: string };
      if (!res.ok) {
        const message = (body as { error?: string }).error || 'Something went wrong';
        setError(message);
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
    <div className="max-w-3xl mx-auto">
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ink-light" />
            Find your taste cluster
          </h1>
          <p className="font-scholarly text-sm text-ink-muted max-w-xl">
            Pick the topics that pull you in. We&apos;ll match you against anonymous
            curator clusters whose libraries lean the same way.
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

      {!data && (
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-terminal text-xs uppercase tracking-wider text-ink-muted">
              Step 1 &middot; Pick {MIN_TOPICS}&ndash;{MAX_TOPICS} topics
            </p>
            <p className="font-terminal text-xs text-ink-muted">
              {totalSelectable} / {MAX_TOPICS} selected
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
                      className={cn(
                        'inline-flex items-center gap-2 font-serif text-base font-semibold transition-colors',
                        selected.includes(topicGroup.topic)
                          ? 'text-ink'
                          : 'text-ink hover:text-ink-light'
                      )}
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
                      const disabled = !active && totalSelectable >= MAX_TOPICS;
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
                  Finding clusters&hellip;
                </>
              ) : (
                <>
                  Find your taste cluster
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            {totalSelectable > 0 && !loading && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="font-terminal text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline"
              >
                Clear selection
              </button>
            )}
            {totalSelectable < MIN_TOPICS && (
              <p className="font-terminal text-xs text-ink-muted">
                Pick at least {MIN_TOPICS} to continue.
              </p>
            )}
          </div>
        </section>
      )}

      {error && (
        <div className="border border-border rounded-md p-4 bg-cream-dark/30 mb-6">
          <p className="font-serif text-sm text-ink">{error}</p>
        </div>
      )}

      {data && (
        <section>
          <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
            <p className="font-terminal text-xs text-ink-muted uppercase tracking-wider">
              {data.results.length} cluster{data.results.length === 1 ? '' : 's'} matched
              {' · '}
              seeded from {data.seed_bookmarks.toLocaleString()} bookmarks across your
              {' '}
              {selected.length} topic{selected.length === 1 ? '' : 's'}
            </p>
            <button
              type="button"
              onClick={reset}
              className="font-terminal text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline"
            >
              Pick different topics
            </button>
          </div>

          {data.results.length === 0 && (
            <div className="border border-border rounded-md p-6 bg-cream-dark/30">
              <p className="font-serif text-sm text-ink">
                No clusters lined up tightly with that mix.
              </p>
              <p className="font-terminal text-xs text-ink-muted mt-1">
                Try swapping in a more specific subtopic, or broadening to a top-level topic.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {data.results.map((cluster, idx) => (
              <article
                key={cluster.cluster_id}
                className="border border-border rounded-lg p-5 bg-cream hover:bg-cream-dark/30 transition-colors"
              >
                <header className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-ink">
                      {clusterLabel(idx)}
                    </h2>
                    <p className="font-terminal text-xs text-ink-muted mt-0.5">
                      {cluster.bookmark_count.toLocaleString()} saves
                      {' · '}
                      {cluster.match_count.toLocaleString()} overlap with your picks
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 max-w-[60%]">
                    {cluster.top_topics.map((t) => (
                      <span
                        key={`${cluster.cluster_id}-${t.topic}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-terminal text-[11px] bg-cream-dark/60 text-ink border border-border/60"
                      >
                        {t.topic}
                        <span className="text-ink-muted">{t.percentage}%</span>
                      </span>
                    ))}
                  </div>
                </header>

                {cluster.sample_bookmarks.length > 0 && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <p className="font-terminal text-[10px] uppercase tracking-wider text-ink-muted mb-2">
                      What this cluster saves
                    </p>
                    <ul className="space-y-1.5">
                      {cluster.sample_bookmarks.map((b) => (
                        <li key={`${cluster.cluster_id}-${b.url}`} className="leading-snug">
                          <Link
                            href={b.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-scholarly text-sm text-ink hover:text-ink-light underline-offset-2 hover:underline"
                          >
                            {b.title || b.url}
                          </Link>
                          {b.domain && (
                            <span className="font-terminal text-[11px] text-ink-muted ml-2">
                              {b.domain}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
