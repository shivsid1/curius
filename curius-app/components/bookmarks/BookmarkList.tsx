'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import { BookmarkCard } from './BookmarkCard';
import { BookmarkSkeleton } from './BookmarkSkeleton';
import { useInfiniteScroll } from '@/lib/hooks';
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
  const handleLoadMore = useCallback(() => {
    if (onLoadMore) onLoadMore();
  }, [onLoadMore]);

  const sentinelRef = useInfiniteScroll(handleLoadMore, {
    hasMore: hasMore && Boolean(onLoadMore),
    isLoading,
  });

  if (!isLoading && bookmarks.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg py-12 px-8 text-center shadow-paper">
        <Image
          src="/illustrations/hiker.png"
          alt=""
          width={140}
          height={140}
          className="mx-auto mb-4"
        />
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

      {/* Infinite scroll sentinel -- always rendered; the hook gates loadMore */}
      <div
        ref={sentinelRef}
        className="h-10 flex items-center justify-center"
        aria-hidden="true"
      >
        {hasMore && !isLoading && (
          <span className="font-terminal text-xs text-ink-muted">
            Scroll for more...
          </span>
        )}
      </div>
    </div>
  );
}
