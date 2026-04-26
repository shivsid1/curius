'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * Attaches an IntersectionObserver to a sentinel element and calls
 * `onLoadMore` when the sentinel becomes visible. Always render the
 * sentinel (`<div ref={ref} />`) unconditionally; the hook decides when
 * to fire `onLoadMore` based on `hasMore` / `isLoading`.
 *
 * Uses a ref callback so the observer attaches the moment the sentinel
 * mounts, avoiding the race where the sentinel renders after the effect
 * runs (and therefore is never observed).
 */
export function useInfiniteScroll(
  onLoadMore: () => void,
  { hasMore, isLoading, rootMargin = '100px', threshold = 0 }: UseInfiniteScrollOptions
) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Keep the latest callback / state in refs so the observer callback
  // always sees fresh values without re-creating the observer.
  const onLoadMoreRef = useRef(onLoadMore);
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Disconnect any previous observer before re-binding.
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      nodeRef.current = node;

      if (!node) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const target = entries[0];
          if (
            target.isIntersecting &&
            hasMoreRef.current &&
            !isLoadingRef.current
          ) {
            onLoadMoreRef.current();
          }
        },
        { root: null, rootMargin, threshold }
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [rootMargin, threshold]
  );

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  return setRef;
}
