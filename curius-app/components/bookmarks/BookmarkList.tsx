'use client';

import { useEffect, useRef, useCallback } from 'react';
import { BookmarkCard } from './BookmarkCard';
import { BookmarkSkeleton } from './BookmarkSkeleton';
import type { Bookmark } from '@/lib/supabase';

interface BookmarkTag {
  topic: string;
  subtopic?: string;
}

interface BookmarkWithMeta extends Bookmark {
  tags?: BookmarkTag[];
  saved_by_users?: string[];
}

interface BookmarkListProps {
  bookmarks: BookmarkWithMeta[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  variant?: 'compact' | 'expanded';
  showUsers?: boolean;
  emptyMessage?: string;
}

export function BookmarkList({
  bookmarks,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  variant = 'compact',
  showUsers = false,
  emptyMessage = 'No bookmarks found',
}: BookmarkListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isLoading && onLoadMore) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    };

    observerRef.current = new IntersectionObserver(handleObserver, option);

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  if (!isLoading && bookmarks.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center shadow-paper">
        <p className="font-scholarly text-ink-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookmarks.map((bookmark) => (
        <BookmarkCard
          key={bookmark.id}
          bookmark={bookmark}
          variant={variant}
          showUsers={showUsers}
        />
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <BookmarkSkeleton key={`skeleton-${i}`} variant={variant} />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      {hasMore && !isLoading && (
        <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
          <span className="font-terminal text-xs text-ink-muted">
            Scroll for more...
          </span>
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && bookmarks.length > 0 && !isLoading && (
        <div className="py-4 text-center">
          <span className="font-terminal text-xs text-ink-muted">
            -- End of list --
          </span>
        </div>
      )}
    </div>
  );
}
