'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainFavicon } from '@/components/shared/DomainFavicon';
import { UserChipGroup } from '@/components/users/UserChip';
import type { BookmarkConvergence } from '@/lib/supabase';

interface ConvergenceCardProps {
  bookmark: BookmarkConvergence;
  className?: string;
}

export function ConvergenceCard({ bookmark, className }: ConvergenceCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Format the saved date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  return (
    <article
      className={cn(
        'group relative bg-card border border-border rounded-lg shadow-paper transition-all duration-200',
        'hover:shadow-md hover:border-terminal-cyan/30',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Convergence score indicator - left accent */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-colors',
          isHovered ? 'bg-terminal-cyan' : 'bg-terminal-cyan/50'
        )}
      />

      <div className="p-4 pl-5">
        {/* Title row with convergence badge */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <Link
            href={bookmark.link || bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link flex-1"
          >
            <h3 className="font-scholarly text-base text-ink leading-tight group-hover/link:text-ink-light transition-colors line-clamp-2">
              {bookmark.title || 'Untitled'}
            </h3>
          </Link>

          {/* Trending score badge */}
          <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 bg-terminal-cyan/10 rounded-md">
            <TrendingUp className="w-3.5 h-3.5 text-terminal-cyan" />
            <span className="font-terminal text-sm text-terminal-cyan font-medium">
              {(bookmark as any).recent_saves || bookmark.saves_count}
            </span>
            <span className="font-terminal text-xs text-ink-muted">
              recent
            </span>
          </div>
        </div>

        {/* Meta row: domain, time */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mb-3">
          {/* Domain with favicon */}
          <div className="flex items-center gap-1.5 font-terminal text-ink-muted">
            <DomainFavicon domain={bookmark.domain} size={14} />
            <span className="truncate max-w-[150px]">{bookmark.domain}</span>
          </div>

          {/* External link */}
          <Link
            href={bookmark.link || bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-muted hover:text-ink-light transition-colors"
            aria-label="Open link in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          {/* Time indicator - push to right */}
          <span className="flex items-center gap-1 ml-auto font-terminal text-xs text-ink-muted">
            <Clock className="w-3 h-3" />
            First saved {formatDate(bookmark.created_at || new Date().toISOString())}
          </span>
        </div>

        {/* Users who saved this */}
        {bookmark.saved_by_users && bookmark.saved_by_users.length > 0 && (
          <div className="pt-3 border-t border-cream-border">
            <div className="flex items-center gap-2">
              <span className="font-terminal text-xs text-ink-muted">
                Curators:
              </span>
              <UserChipGroup
                users={bookmark.saved_by_users.map((u) => ({ username: u }))}
                maxDisplay={5}
              />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
