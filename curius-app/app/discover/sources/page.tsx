'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
import { useSources } from '@/lib/hooks';
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

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
        loadMore();
      }
    },
    [hasMore, isLoading, isLoadingMore, loadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div>
      <h1 className="font-serif text-xl font-semibold text-ink mb-2">Sources</h1>
      <p className="font-scholarly text-sm text-ink-muted mb-6">
        Browse by publication -- see which domains the community reads most.
      </p>

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

          {hasMore && !isLoadingMore && (
            <div ref={sentinelRef} className="h-10 flex items-center justify-center">
              <span className="font-terminal text-xs text-ink-muted">
                Scroll for more...
              </span>
            </div>
          )}

          {!hasMore && items.length > 0 && !isLoading && (
            <div className="py-4 text-center">
              <span className="font-terminal text-xs text-ink-muted">
                -- End of list --
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
