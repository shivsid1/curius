'use client';

import { useState } from 'react';
import { ConvergenceFilters } from '@/components/convergence/ConvergenceFilters';
import { ConvergenceCard } from '@/components/convergence/ConvergenceCard';
import { BookmarkListSkeleton } from '@/components/bookmarks/BookmarkSkeleton';
import { useConvergence, useInfiniteScroll } from '@/lib/hooks';

export default function ConvergencePage() {
  const [days, setDays] = useState(7);
  const [domain, setDomain] = useState('');

  const { bookmarks, pagination, isLoading, isLoadingMore, hasMore, loadMore } =
    useConvergence({ days, domain: domain || undefined });

  const sentinelRef = useInfiniteScroll(loadMore, {
    hasMore,
    isLoading: isLoading || isLoadingMore,
  });

  return (
    <div>
      {/* Page header */}
      <h1 className="font-serif text-xl font-semibold text-ink mb-2">Convergence</h1>
      <p className="font-scholarly text-sm text-ink-muted mb-6">
        Links saved independently by multiple curators. A signal worth paying attention to.
      </p>

      {/* Filters */}
      <ConvergenceFilters
        days={days}
        onDaysChange={setDays}
        domain={domain}
        onDomainChange={setDomain}
        totalResults={pagination?.total}
      />

      {/* Results */}
      {isLoading && bookmarks.length === 0 ? (
        <BookmarkListSkeleton count={5} variant="expanded" />
      ) : bookmarks.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-paper">
          <p className="font-scholarly text-ink-muted">
            No trending bookmarks found for this time window.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((bookmark) => (
            <ConvergenceCard key={bookmark.id} bookmark={bookmark} />
          ))}

          {/* Loading more indicator */}
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
