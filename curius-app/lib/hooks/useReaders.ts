'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  ReaderProfile,
  ReaderDirectoryEntry,
  ReaderShelfBookmark,
} from '@/lib/supabase';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Single reader's public profile.
export function useReader(readerNo: number | null) {
  const [reader, setReader] = useState<ReaderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (readerNo == null || !Number.isFinite(readerNo)) {
      setIsLoading(false);
      setError('Invalid reader number');
      return;
    }

    let cancelled = false;
    async function fetchReader() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/readers/${readerNo}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || 'Failed to fetch reader');
          setReader(null);
        } else {
          setReader(body.data as ReaderProfile);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchReader();
    return () => {
      cancelled = true;
    };
  }, [readerNo]);

  return { reader, isLoading, error };
}

// A reader's shelf with infinite-scroll pagination and optional topic filter.
export function useReaderShelf(readerNo: number | null, topic: string | null) {
  const [bookmarks, setBookmarks] = useState<ReaderShelfBookmark[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setBookmarks([]);
  }, [readerNo, topic]);

  useEffect(() => {
    if (readerNo == null || !Number.isFinite(readerNo)) return;

    let cancelled = false;
    async function fetchShelf() {
      try {
        if (page === 1) setIsLoading(true);
        else setIsLoadingMore(true);

        const params = new URLSearchParams({ page: String(page) });
        if (topic) params.set('topic', topic);

        const res = await fetch(`/api/readers/${readerNo}/bookmarks?${params}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || 'Failed to fetch shelf');
        } else {
          setBookmarks((prev) =>
            page === 1 ? body.data : [...prev, ...body.data]
          );
          setPagination(body.pagination);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }

    fetchShelf();
    return () => {
      cancelled = true;
    };
  }, [readerNo, topic, page]);

  const hasMore = pagination ? pagination.hasNext : false;
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && !isLoadingMore) setPage((p) => p + 1);
  }, [hasMore, isLoading, isLoadingMore]);

  return { bookmarks, pagination, isLoading, isLoadingMore, hasMore, loadMore, error };
}

// Directory of notable readers.
export function useReaderDirectory(sort: 'active' | 'shelf_size') {
  const [readers, setReaders] = useState<ReaderDirectoryEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setReaders([]);
  }, [sort]);

  useEffect(() => {
    let cancelled = false;
    async function fetchReaders() {
      try {
        if (page === 1) setIsLoading(true);
        else setIsLoadingMore(true);

        const res = await fetch(`/api/readers?sort=${sort}&page=${page}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || 'Failed to fetch readers');
        } else {
          setReaders((prev) => (page === 1 ? body.data : [...prev, ...body.data]));
          setPagination(body.pagination);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }

    fetchReaders();
    return () => {
      cancelled = true;
    };
  }, [sort, page]);

  const hasMore = pagination ? pagination.hasNext : false;
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && !isLoadingMore) setPage((p) => p + 1);
  }, [hasMore, isLoading, isLoadingMore]);

  return { readers, pagination, isLoading, isLoadingMore, hasMore, loadMore, error };
}
