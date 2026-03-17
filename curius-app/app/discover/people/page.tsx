'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
import { usePeople } from '@/lib/hooks';
import { CuratorCard } from '@/components/people/CuratorCard';
import { CuratorListSkeleton } from '@/components/people/CuratorSkeleton';
import { cn } from '@/lib/utils';

const sortOptions = [
  { key: 'active', label: 'Most Active' },
  { key: 'recent', label: 'Recently Online' },
  { key: 'newest', label: 'Newest' },
] as const;

type SortKey = (typeof sortOptions)[number]['key'];

export default function PeoplePage() {
  const [sort, setSort] = useState<SortKey>('active');

  const { items, pagination, isLoading, isLoadingMore, hasMore, loadMore } =
    usePeople({ sort });

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
      <h1 className="font-serif text-xl font-semibold text-ink mb-2">People</h1>
      <p className="font-scholarly text-sm text-ink-muted mb-6">
        Discover curators by what they read -- find people with taste.
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
            {pagination.total.toLocaleString()} curators
          </span>
        )}
      </div>

      {/* Results */}
      {isLoading && items.length === 0 ? (
        <CuratorListSkeleton count={10} />
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-paper">
          <p className="font-scholarly text-ink-muted">No curators found.</p>
        </div>
      ) : (
        <div>
          {items.map((curator) => (
            <CuratorCard key={curator.id} curator={curator} />
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
