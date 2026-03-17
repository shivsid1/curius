'use client';

import Link from 'next/link';
import { Search, Shuffle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return `${n}`;
}

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isShuffling, setIsShuffling] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.bookmarks === 'number') {
          setBookmarkCount(data.bookmarks);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch stats:', err);
      });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/discover/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleRandom = useCallback(async () => {
    setIsShuffling(true);
    try {
      const res = await fetch('/api/bookmarks/random?minSaves=5');
      const data = await res.json();
      if (data.data?.link) {
        window.open(data.data.link, '_blank');
      }
    } catch (err) {
      console.error('Failed to fetch random bookmark:', err);
    } finally {
      setIsShuffling(false);
    }
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/discover" className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight text-ink">
            Curius
          </span>
          {bookmarkCount !== null && (
            <span className="font-terminal text-ink-muted">
              {formatCount(bookmarkCount)} links
            </span>
          )}
        </Link>

        {/* Quick Search */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <Input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-9 h-9 bg-cream-dark/60 border-border font-terminal text-sm placeholder:text-ink-muted focus:border-ink-light focus:bg-white"
            />
          </div>
        </form>

        {/* Random */}
        <button
          onClick={handleRandom}
          disabled={isShuffling}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-cream-dark transition-colors disabled:opacity-50"
          title="Open a random bookmark"
        >
          <Shuffle className={`w-4 h-4 ${isShuffling ? 'animate-spin' : ''}`} />
          <span className="font-terminal text-xs hidden sm:inline">
            Surprise me
          </span>
        </button>
      </div>
    </header>
  );
}
