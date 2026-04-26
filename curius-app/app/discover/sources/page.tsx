'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowDownWideNarrow } from 'lucide-react';
import { useSources, useInfiniteScroll } from '@/lib/hooks';
import { SourceCard } from '@/components/sources/SourceCard';
import { SourceListSkeleton } from '@/components/sources/SourceSkeleton';
import { cn } from '@/lib/utils';

const sortOptions = [
  { key: 'saves', label: 'Most Saved' },
  { key: 'count', label: 'Most Links' },
  { key: 'recent', label: 'Newest' },
] as const;

type SortKey = (typeof sortOptions)[number]['key'];

export default function SourcesPage() {
  const [sort, setSort] = useState<SortKey>('saves');

  const { items, pagination, isLoading, isLoadingMore, hasMore, loadMore } =
    useSources({ sort });

  const sentinelRef = useInfiniteScroll(loadMore, {
    hasMore,
    isLoading: isLoading || isLoadingMore,
  });

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink mb-2">Roots</h1>
          <p className="font-scholarly text-sm text-ink-muted">
            The most popular root sources people are indexing.
          </p>
        </div>
        <Image
          src="/illustrations/scholar.png"
          alt=""
          width={110}
          height={110}
          className="hidden md:block -mb-2"
        />
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-6">
        <ArrowDownWideNarrow className="w-4 h-4 text-ink-muted" />
        <div className="flex items-center gap-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={cn(
                'px-3 py-1 text-xs font-terminal rounded-full border transition-colors',
                sort === opt.key
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-transparent text-ink-muted border-cream-border hover:border-ink-light hover:text-ink-light'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {pagination && (
          <span className="font-terminal text-xs text-ink-muted ml-auto">
            {pagination.total.toLocaleString()} sources
          </span>
        )}
      </div>

      {/* Results */}
      {isLoading && items.length === 0 ? (
        <SourceListSkeleton count={10} />
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-paper">
          <p className="font-scholarly text-ink-muted">No sources found.</p>
        </div>
      ) : (
        <div>
          {items.map((source) => (
            <SourceCard key={source.domain} source={source} />
          ))}

          {isLoadingMore && (
            <div className="py-4 text-center">
              <span className="font-terminal text-xs text-ink-muted">
                Loading more...
              </span>
            </div>
          )}

          {/* Infinite scroll sentinel -- always rendered; hook gates loadMore */}
          <div
            ref={sentinelRef}
            className="h-10 flex items-center justify-center"
            aria-hidden="true"
          >
            {hasMore && !isLoadingMore && (
              <span className="font-terminal text-xs text-ink-muted">
                Scroll for more...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
