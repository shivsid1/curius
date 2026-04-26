'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

function formatCount(n: number): string {
  return n.toLocaleString();
}

export function Header() {
  const [bookmarkCount, setBookmarkCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchStats = () => {
      fetch('/api/stats')
        .then((res) => res.json())
        .then((data) => {
          if (typeof data.bookmarks === 'number') {
            setBookmarkCount(data.bookmarks);
          }
        })
        .catch(() => {});
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-sm">
      <div className="container flex h-28 items-center px-4 md:px-6">
        <Link href="/discover" className="flex items-center gap-4">
          <Image
            src="/illustrations/compass.png"
            alt=""
            width={200}
            height={200}
            className="w-20 h-20"
          />
          <div>
            <span className="font-atlas text-2xl text-ink tracking-wide">
              Curius Atlas
            </span>
            {bookmarkCount !== null && (
              <p className="font-terminal text-[10px] text-ink-muted -mt-0.5">
                {formatCount(bookmarkCount)} bookmarks catalogued
              </p>
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
