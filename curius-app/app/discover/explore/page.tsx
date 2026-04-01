'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowDownWideNarrow, ChevronLeft, ChevronRight } from 'lucide-react';
import { CategoryNav } from '@/components/categories/CategoryNav';
import { BookmarkList } from '@/components/bookmarks/BookmarkList';
import { BookmarkListSkeleton } from '@/components/bookmarks/BookmarkSkeleton';
import { useTopics, useBookmarksByTopic } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Newest' },
  { value: 'popular', label: 'Most Saved' },
  { value: 'domain', label: 'By Source' },
] as const;

export default function ExplorePage() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | null>(null);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);

  const { topics, isLoading: topicsLoading } = useTopics();
  const { bookmarks, pagination, isLoading } = useBookmarksByTopic({
    topic: selectedTopic,
    subtopic: selectedSubtopic,
    sort,
    initialPage: page,
  });

  const handleSelectTopic = (topic: string, subtopic?: string) => {
    if (selectedTopic === topic && !subtopic) {
      setSelectedTopic(null);
      setSelectedSubtopic(null);
    } else {
      setSelectedTopic(topic);
      setSelectedSubtopic(subtopic ?? null);
    }
    setPage(1);
  };

  const handleSort = (value: string) => {
    setSort(value);
    setPage(1);
  };

  const heading = selectedSubtopic
    ? `${selectedTopic} > ${selectedSubtopic}`
    : selectedTopic ?? 'All Bookmarks';

  return (
    <div className="flex gap-12">
      {/* Sidebar -- desktop only */}
      <aside className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-24">
          {topicsLoading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 bg-cream-dark/50 rounded-md animate-pulse"
                />
              ))}
            </div>
          ) : (
            <CategoryNav
              topics={topics}
              selectedTopic={selectedTopic}
              selectedSubtopic={selectedSubtopic}
              onSelect={handleSelectTopic}
            />
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile topic pills -- horizontal scroll */}
        <div className="lg:hidden mb-4 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-4 pb-2">
            <button
              onClick={() => {
                setSelectedTopic(null);
                setSelectedSubtopic(null);
                setPage(1);
              }}
              className={cn(
                'relative shrink-0 py-1.5 text-sm font-terminal whitespace-nowrap transition-colors',
                !selectedTopic ? 'text-ink font-medium' : 'text-ink-muted'
              )}
            >
              All
              {!selectedTopic && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink rounded-full" />}
            </button>
            {topics.map((t) => (
              <button
                key={t.topic}
                onClick={() => handleSelectTopic(t.topic)}
                className={cn(
                  'relative shrink-0 py-1.5 text-sm font-terminal whitespace-nowrap transition-colors',
                  selectedTopic === t.topic ? 'text-ink font-medium' : 'text-ink-muted'
                )}
              >
                {t.topic}
                {selectedTopic === t.topic && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* Section heading */}
        <h1 className="font-serif text-xl font-semibold text-ink mb-3">{heading}</h1>

        {/* Sort controls + page info */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ArrowDownWideNarrow className="w-4 h-4 text-ink-muted" />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSort(opt.value)}
                className={cn(
                  'px-2.5 py-1 font-terminal text-xs rounded-md transition-colors',
                  sort === opt.value
                    ? 'bg-ink text-cream'
                    : 'text-ink-muted hover:text-ink hover:bg-cream-dark'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {pagination && (
            <span className="font-terminal text-xs text-ink-muted">
              {pagination.total.toLocaleString()} results
            </span>
          )}
        </div>

        {/* Bookmark list */}
        {isLoading && bookmarks.length === 0 ? (
          <BookmarkListSkeleton count={5} />
        ) : (
          <BookmarkList
            bookmarks={bookmarks}
            isLoading={isLoading}
            hasMore={false}
            variant="compact"
            showUsers={false}
            emptyMessage="No bookmarks found for this topic."
          />
        )}

        {/* Pagination controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8 pb-4">
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={!pagination.hasPrev}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-md font-terminal text-xs transition-colors',
                pagination.hasPrev
                  ? 'text-ink hover:bg-cream-dark'
                  : 'text-ink-muted/40 cursor-not-allowed'
              )}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            <span className="font-terminal text-xs text-ink-muted">
              {pagination.page} / {pagination.totalPages}
            </span>

            <button
              onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              disabled={!pagination.hasNext}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-md font-terminal text-xs transition-colors',
                pagination.hasNext
                  ? 'text-ink hover:bg-cream-dark'
                  : 'text-ink-muted/40 cursor-not-allowed'
              )}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
