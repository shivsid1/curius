'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { BookmarkSkeleton } from '@/components/bookmarks/BookmarkSkeleton';
import { DomainFavicon } from '@/components/shared/DomainFavicon';
import type { User, Bookmark } from '@/lib/supabase';

interface UserBookmarkItem extends Bookmark {
  saved_at: string;
  page_number: number | null;
  discovered_from: string | null;
}

interface UserProfileResponse {
  user: User;
  bookmarks: UserBookmarkItem[] | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null;
}

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;

  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<UserBookmarkItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchUser = useCallback(
    async (pageNum: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const res = await fetch(
          `/api/users/${encodeURIComponent(username)}?includeBookmarks=true&page=${pageNum}&limit=50`
        );

        if (!res.ok) {
          if (res.status === 404) {
            setError('User not found');
          } else {
            setError('Failed to load user profile');
          }
          return;
        }

        const data: UserProfileResponse = await res.json();

        setUser(data.user);

        if (data.bookmarks) {
          if (append) {
            setBookmarks((prev) => [...prev, ...data.bookmarks!]);
          } else {
            setBookmarks(data.bookmarks);
          }
        }

        setHasMore(data.pagination?.hasNext ?? false);
        setPage(pageNum);
        setError(null);
      } catch {
        setError('Failed to load user profile');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [username]
  );

  useEffect(() => {
    fetchUser(1);
  }, [fetchUser]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      fetchUser(page + 1, true);
    }
  }, [hasMore, isLoadingMore, fetchUser, page]);

  // Infinite scroll observer
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

  // Derive display name
  const displayName = user
    ? user.display_name ||
      [user.first_name, user.last_name].filter(Boolean).join(' ') ||
      user.username
    : username;

  // Error state
  if (error && !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-3xl px-4 py-8">
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 font-terminal text-sm text-ink-muted hover:text-ink transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Discover
          </Link>
          <div className="py-8 text-center">
            <p className="font-serif text-ink-muted">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl px-4 py-8">
        {/* Back link */}
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 font-terminal text-sm text-ink-muted hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </Link>

        {/* User header */}
        {isLoading && !user ? (
          <div className="mb-8 animate-pulse">
            <div className="h-8 w-48 bg-cream-dark rounded mb-2" />
            <div className="h-5 w-32 bg-cream-dark rounded mb-1" />
            <div className="h-4 w-24 bg-cream-dark rounded" />
          </div>
        ) : user ? (
          <div className="mb-8 pb-6 border-b border-border">
            <h1 className="font-serif text-2xl font-semibold text-ink mb-1">
              {displayName}
            </h1>
            <p className="font-terminal text-sm text-ink-muted mb-2">
              @{user.username}
            </p>
            <div className="font-terminal text-xs text-ink-muted">
              <span className="text-ink font-medium">
                {user.bookmark_count.toLocaleString()}
              </span>{' '}
              bookmark{user.bookmark_count !== 1 ? 's' : ''} saved
            </div>
          </div>
        ) : null}

        {/* Bookmarks list */}
        <div>
          {bookmarks.map((bookmark) => (
            <article
              key={bookmark.id}
              className="group relative py-4 border-b border-border/50 last:border-b-0 transition-colors hover:bg-cream-dark/40"
            >
              <div className="px-1">
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <Link
                    href={bookmark.link || bookmark.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/link flex-1"
                  >
                    <h3 className="font-serif text-[15px] font-medium text-ink leading-snug group-hover/link:text-terminal-cyan transition-colors line-clamp-2">
                      {bookmark.title || 'Untitled'}
                    </h3>
                  </Link>
                  <Link
                    href={bookmark.link || bookmark.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1 text-ink-muted opacity-0 group-hover:opacity-100 hover:text-ink transition-all"
                    aria-label="Open link in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="flex items-center gap-1.5 text-ink-muted">
                    <DomainFavicon domain={bookmark.domain} size={14} />
                    <span className="font-terminal truncate max-w-[160px]">
                      {bookmark.domain}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {/* Loading initial */}
          {isLoading && bookmarks.length === 0 && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <BookmarkSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Loading more */}
          {isLoadingMore && (
            <div className="py-4 text-center">
              <span className="font-terminal text-xs text-ink-muted">
                Loading more...
              </span>
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {hasMore && !isLoadingMore && (
            <div ref={sentinelRef} className="h-10 flex items-center justify-center">
              <span className="font-terminal text-xs text-ink-muted">
                Scroll for more...
              </span>
            </div>
          )}

          {/* End of list */}
          {!hasMore && bookmarks.length > 0 && !isLoading && (
            <div className="py-4 text-center">
              <span className="font-terminal text-xs text-ink-muted">
                -- End of list --
              </span>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && bookmarks.length === 0 && user && (
            <div className="py-8 text-center">
              <p className="font-serif text-ink-muted">
                This user has not saved any bookmarks yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
