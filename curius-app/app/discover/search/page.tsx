'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SearchInput } from '@/components/search/SearchInput';
import { SearchFilters } from '@/components/search/SearchFilters';
import { BookmarkList } from '@/components/bookmarks/BookmarkList';
import { BookmarkListSkeleton } from '@/components/bookmarks/BookmarkSkeleton';
import { useSearch } from '@/lib/hooks';

function SearchPageInner() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Sync query state if URL param changes (e.g. via header search)
  useEffect(() => {
    const urlQuery = searchParams.get('q') ?? '';
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery);
    }
    // Only react to URL param changes, not local query state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { bookmarks, pagination, isLoading, hasMore, loadMore } = useSearch({
    query,
    topic: selectedTopic,
  });

  const showResults = query.trim().length > 0;

  return (
    <div>
      {/* Page header */}
      <h1 className="font-serif text-xl font-semibold text-ink mb-6">Search</h1>

      {/* Search input */}
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search for articles, papers, tools..."
        autoFocus
      />

      {/* Topic filter pills */}
      <div className="mt-4">
        <SearchFilters
          selectedTopic={selectedTopic}
          onTopicChange={setSelectedTopic}
        />
      </div>

      {/* Results */}
      {!showResults ? (
        <div className="py-8 text-center">
          <p className="font-serif text-ink-muted">
            Start typing to search across all bookmarks.
          </p>
        </div>
      ) : isLoading && bookmarks.length === 0 ? (
        <BookmarkListSkeleton count={5} />
      ) : (
        <>
          {/* Results count */}
          {pagination && (
            <div className="mb-4 font-terminal text-xs text-ink-muted">
              <span className="text-terminal-cyan">
                {pagination.total.toLocaleString()}
              </span>{' '}
              result{pagination.total !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
              {selectedTopic && (
                <span>
                  {' '}in <span className="text-terminal-cyan">{selectedTopic}</span>
                </span>
              )}
            </div>
          )}

          <BookmarkList
            bookmarks={bookmarks}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            variant="compact"
            showUsers
            emptyMessage={`No results found for "${query}".`}
          />
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink mb-6">Search</h1>
          <BookmarkListSkeleton count={3} />
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
