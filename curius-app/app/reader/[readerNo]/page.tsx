'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReader, useReaderShelf, useInfiniteScroll } from '@/lib/hooks';
import { TasteFingerprint } from '@/components/readers/TasteFingerprint';
import { BookmarkCard } from '@/components/bookmarks/BookmarkCard';
import { BookmarkListSkeleton } from '@/components/bookmarks/BookmarkSkeleton';
import { Ornament } from '@/components/shared/Ornament';
import { TAXONOMY } from '@/lib/utils/taxonomy';
import type { Bookmark } from '@/lib/supabase';

const TOPIC_FILTERS = Object.keys(TAXONOMY);

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function ReaderPage({
  params,
}: {
  params: Promise<{ readerNo: string }>;
}) {
  const { readerNo: readerNoParam } = use(params);
  const readerNo = parseInt(readerNoParam, 10);
  const [topic, setTopic] = useState<string | null>(null);

  const { reader, isLoading: profileLoading, error: profileError } = useReader(
    Number.isFinite(readerNo) ? readerNo : null
  );
  const { bookmarks, pagination, isLoading, isLoadingMore, hasMore, loadMore } =
    useReaderShelf(Number.isFinite(readerNo) ? readerNo : null, topic);

  const sentinelRef = useInfiniteScroll(loadMore, {
    hasMore,
    isLoading: isLoading || isLoadingMore,
  });

  if (profileError && !profileLoading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="font-cartographic text-sm text-ink-muted tracking-widest mb-3">
          NO SUCH ENTRY
        </p>
        <p className="font-serif text-base text-ink mb-6">
          No reader is catalogued under that number.
        </p>
        <Link
          href="/discover/readers"
          className="inline-flex items-center gap-1.5 font-terminal text-sm text-ink-light hover:text-ink underline-offset-2 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to the reading room
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/discover/readers"
        className="inline-flex items-center gap-1.5 font-terminal text-xs text-ink-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft className="w-3 h-3" />
        The reading room
      </Link>

      {/* Specimen label */}
      <header className="mb-8">
        {profileLoading ? (
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-cream-dark rounded mb-4" />
            <div className="h-16 w-full max-w-sm bg-cream-dark rounded" />
          </div>
        ) : reader ? (
          <>
            <h1 className="font-cartographic text-2xl text-ink tracking-widest mb-1">
              READER N&ordm; {reader.reader_no}
            </h1>
            <p className="font-scholarly text-sm text-ink-muted mb-5">
              An anonymous reader, catalogued by taste.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <TasteFingerprint fingerprint={reader.taste_fingerprint} />

              <div className="space-y-1.5 font-terminal text-xs text-ink-muted">
                <p className="flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" />
                  {reader.bookmark_count.toLocaleString()} bookmarks catalogued
                </p>
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" />
                  Reading since {formatDate(reader.first_seen)}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Last active {formatRelative(reader.last_active)}
                </p>
              </div>
            </div>
          </>
        ) : null}
      </header>

      <Ornament variant="divider" className="mb-6" />

      {/* Shelf */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="font-serif text-lg font-semibold text-ink">Their shelf</h2>
          {pagination && (
            <span className="font-terminal text-xs text-ink-muted">
              {pagination.total.toLocaleString()} entries
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <button
            type="button"
            onClick={() => setTopic(null)}
            className={cn(
              'px-2.5 py-1 rounded-md font-terminal text-xs border transition-colors',
              topic === null
                ? 'bg-ink text-cream border-ink'
                : 'bg-cream text-ink border-border hover:border-ink/60'
            )}
          >
            All
          </button>
          {TOPIC_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(topic === t ? null : t)}
              className={cn(
                'px-2.5 py-1 rounded-md font-terminal text-xs border transition-colors',
                topic === t
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-cream text-ink border-border hover:border-ink/60'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading && bookmarks.length === 0 ? (
          <BookmarkListSkeleton count={8} />
        ) : bookmarks.length === 0 ? (
          <div className="border border-border rounded-md p-6 bg-cream-dark/30">
            <p className="font-serif text-sm text-ink">
              Nothing catalogued {topic ? `under ${topic}` : 'yet'}.
            </p>
          </div>
        ) : (
          <div>
            {bookmarks.map((b) => (
              <BookmarkCard
                key={`${b.id}-${b.saved_at}`}
                bookmark={
                  {
                    ...b,
                    created_at: b.saved_at ?? '',
                    first_saved_at: b.saved_at ?? undefined,
                    bookmark_tags_v2: b.topic ? [{ topic: b.topic }] : undefined,
                  } as Bookmark & {
                    first_saved_at?: string;
                    bookmark_tags_v2?: Array<{ topic: string }>;
                  }
                }
              />
            ))}

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
          </div>
        )}
      </section>
    </div>
  );
}
