'use client';

import { useState } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';
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

  const { topics, isLoading: topicsLoading } = useTopics();
  const { bookmarks, isLoading, hasMore, loadMore } = useBookmarksByTopic({
    topic: selectedTopic,
    subtopic: selectedSubtopic,
    sort,
  });

  const handleSelectTopic = (topic: string, subtopic?: string) => {
    if (selectedTopic === topic && !subtopic) {
      // Clicking the same top-level topic again clears the selection
      setSelectedTopic(null);
      setSelectedSubtopic(null);
    } else {
      setSelectedTopic(topic);
      setSelectedSubtopic(subtopic ?? null);
    }
  };

  // Build the heading based on current selection
  const heading = selectedSubtopic
    ? `${selectedTopic} > ${selectedSubtopic}`
    : selectedTopic ?? 'All Bookmarks';

  return (
    <div className="flex gap-8">
      {/* Sidebar -- desktop only */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20">
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
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => {
                setSelectedTopic(null);
                setSelectedSubtopic(null);
              }}
              className={cn(
                'shrink-0 px-3 py-1.5 text-sm font-terminal rounded-full border transition-colors whitespace-nowrap',
                !selectedTopic
                  ? 'bg-ink text-cream border-ink'
                  : 'bg-transparent text-ink-muted border-cream-border hover:border-ink-light hover:text-ink-light'
              )}
            >
              All
            </button>
            {topics.map((t) => (
              <button
                key={t.topic}
                onClick={() => handleSelectTopic(t.topic)}
                className={cn(
                  'shrink-0 px-3 py-1.5 text-sm font-terminal rounded-full border transition-colors whitespace-nowrap',
                  selectedTopic === t.topic
                    ? 'bg-ink text-cream border-ink'
                    : 'bg-transparent text-ink-muted border-cream-border hover:border-ink-light hover:text-ink-light'
                )}
              >
                {t.topic}
              </button>
            ))}
          </div>
        </div>

        {/* Section heading + sort */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-xl font-semibold text-ink">{heading}</h1>

          <div className="flex items-center gap-1">
            <ArrowDownWideNarrow className="w-4 h-4 text-ink-muted" />
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
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
        </div>

        {/* Bookmark list */}
        {isLoading && bookmarks.length === 0 ? (
          <BookmarkListSkeleton count={5} />
        ) : (
          <BookmarkList
            bookmarks={bookmarks}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            variant="compact"
            showUsers={false}
            emptyMessage="No bookmarks found for this topic."
          />
        )}
      </div>
    </div>
  );
}
