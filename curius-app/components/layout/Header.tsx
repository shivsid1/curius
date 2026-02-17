'use client';

import Link from 'next/link';
import { Search, Shuffle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isShuffling, setIsShuffling] = useState(false);
  const router = useRouter();

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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/discover" className="flex items-center gap-2">
          <span className="font-handwritten text-2xl text-ink tracking-tight">
            Curius
          </span>
        </Link>

        {/* Quick Search */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <Input
              type="search"
              placeholder="Quick search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9 h-9 bg-cream-dark border-cream-border font-terminal text-sm placeholder:text-ink-muted focus:border-ink-light"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Random button */}
          <button
            onClick={handleRandom}
            disabled={isShuffling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-terminal-cyan/10 hover:bg-terminal-cyan/20 transition-colors disabled:opacity-50"
            title="Open a random bookmark"
          >
            <Shuffle className={`w-4 h-4 text-terminal-cyan ${isShuffling ? 'animate-spin' : ''}`} />
            <span className="font-terminal text-xs text-terminal-cyan hidden sm:inline">
              Surprise me
            </span>
          </button>

          {/* Stats indicator */}
          <div className="font-terminal text-xs text-ink-muted">
            <span className="text-terminal-cyan">83K+</span> bookmarks
          </div>
        </div>
      </div>
    </header>
  );
}
