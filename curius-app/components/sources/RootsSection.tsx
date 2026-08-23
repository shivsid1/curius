'use client';

import { useState } from 'react';
import { ArrowDownWideNarrow, ChevronDown } from 'lucide-react';
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

// The Roots list: most-indexed root domains. Lives inside the Atlas page --
// the map shows the territory, this lists the landmarks. Uses a manual
// "Show more" button (not auto-infinite-scroll) so the sections and footer
// below it stay reachable.
export function RootsSection() {
  const [sort, setSort] = useState<SortKey>('saves');

  const { items, pagination, isLoading, isLoadingMore, hasMore, loadMore } =
    useSources({ sort });

  return (
    <div>
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

          {hasMore && (
            <div className="py-4 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md font-terminal text-xs border border-border text-ink hover:border-ink/60 transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? 'Loading…' : 'Show more sources'}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
