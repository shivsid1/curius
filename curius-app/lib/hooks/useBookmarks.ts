'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BookmarkWithTags, BookmarkConvergence, TopicStats } from '@/lib/supabase';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface BookmarksResponse {
  data: BookmarkWithTags[];
  pagination: PaginationInfo;
  filters?: {
    topic?: string;
    subtopic?: string;
  };
}

interface TopicsResponse {
  data: TopicStats[];
  total: number;
}

export function useTopics() {
  const [topics, setTopics] = useState<TopicStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopics() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/topics');
        if (!res.ok) throw new Error('Failed to fetch topics');
        const data: TopicsResponse = await res.json();
        setTopics(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopics();
  }, []);

  return { topics, isLoading, error };
}

interface UseBookmarksOptions {
  topic?: string | null;
  subtopic?: string | null;
  initialPage?: number;
  limit?: number;
}

export function useBookmarksByTopic({
  topic,
  subtopic,
  initialPage = 1,
  limit = 20,
}: UseBookmarksOptions = {}) {
  const [bookmarks, setBookmarks] = useState<BookmarkWithTags[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookmarks = useCallback(
    async (page: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
        });

        if (topic) params.set('topic', topic);
        if (subtopic) params.set('subtopic', subtopic);

        const res = await fetch(`/api/bookmarks/by-topic?${params}`);
        if (!res.ok) throw new Error('Failed to fetch bookmarks');

        const data: BookmarksResponse = await res.json();

        if (append) {
          setBookmarks((prev) => [...prev, ...data.data]);
        } else {
          setBookmarks(data.data);
        }

        setPagination(data.pagination);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [topic, subtopic, limit]
  );

  useEffect(() => {
    fetchBookmarks(initialPage);
  }, [fetchBookmarks, initialPage]);

  const loadMore = useCallback(() => {
    if (pagination?.hasNext && !isLoadingMore) {
      fetchBookmarks(pagination.page + 1, true);
    }
  }, [pagination, isLoadingMore, fetchBookmarks]);

  return {
    bookmarks,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    hasMore: pagination?.hasNext ?? false,
  };
}

interface UseConvergenceOptions {
  days?: number;
  domain?: string | null;
  initialPage?: number;
  limit?: number;
}

export function useConvergence({
  days = 7,
  domain,
  initialPage = 1,
  limit = 20,
}: UseConvergenceOptions = {}) {
  const [bookmarks, setBookmarks] = useState<BookmarkConvergence[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConvergence = useCallback(
    async (page: number, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          days: days.toString(),
        });

        if (domain) params.set('domain', domain);

        const res = await fetch(`/api/stats/convergence?${params}`);
        if (!res.ok) throw new Error('Failed to fetch convergence data');

        const data = await res.json();

        if (append) {
          setBookmarks((prev) => [...prev, ...data.data]);
        } else {
          setBookmarks(data.data);
        }

        setPagination(data.pagination);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [days, domain, limit]
  );

  useEffect(() => {
    fetchConvergence(initialPage);
  }, [fetchConvergence, initialPage]);

  const loadMore = useCallback(() => {
    if (pagination?.hasNext && !isLoadingMore) {
      fetchConvergence(pagination.page + 1, true);
    }
  }, [pagination, isLoadingMore, fetchConvergence]);

  return {
    bookmarks,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    hasMore: pagination?.hasNext ?? false,
  };
}

interface UseSearchOptions {
  query: string;
  topic?: string | null;
  initialPage?: number;
  limit?: number;
}

export function useSearch({
  query,
  topic,
  initialPage = 1,
  limit = 20,
}: UseSearchOptions) {
  const [bookmarks, setBookmarks] = useState<BookmarkWithTags[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchBookmarks = useCallback(
    async (page: number, append = false) => {
      if (!query.trim()) {
        setBookmarks([]);
        setPagination(null);
        return;
      }

      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const params = new URLSearchParams({
          q: query,
          page: page.toString(),
          limit: limit.toString(),
        });

        if (topic) params.set('topic', topic);

        const res = await fetch(`/api/bookmarks/search?${params}`);
        if (!res.ok) throw new Error('Failed to search bookmarks');

        const data = await res.json();

        if (append) {
          setBookmarks((prev) => [...prev, ...data.data]);
        } else {
          setBookmarks(data.data);
        }

        setPagination(data.pagination);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [query, topic, limit]
  );

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchBookmarks(initialPage);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchBookmarks, initialPage]);

  const loadMore = useCallback(() => {
    if (pagination?.hasNext && !isLoadingMore) {
      searchBookmarks(pagination.page + 1, true);
    }
  }, [pagination, isLoadingMore, searchBookmarks]);

  return {
    bookmarks,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    hasMore: pagination?.hasNext ?? false,
  };
}
