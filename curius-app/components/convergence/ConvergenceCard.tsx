'use client';

import Link from 'next/link';
import { ExternalLink, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainFavicon } from '@/components/shared/DomainFavicon';
import type { BookmarkConvergence } from '@/lib/supabase';

interface ConvergenceCardProps {
  bookmark: BookmarkConvergence;
  className?: string;
}

export function ConvergenceCard({ bookmark, className }: ConvergenceCardProps) {
  const recentSaves = (bookmark as BookmarkConvergence & { recent_saves?: number }).recent_saves || bookmark.saves_count;

  return (
    <article
      className={cn(
        'group relative py-4 border-b border-border/50 last:border-b-0 transition-colors',
        'hover:bg-cream-dark/40',
        className
      )}
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
            <h3 className="font-serif text-[15px] font-medium text-ink leading-snug group-hover/link:text-ink-light transition-colors line-clamp-2">
              {bookmark.title || 'Untitled'}
            </h3>
          </Link>

          {/* Trending score */}
          <div className="shrink-0 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-ink-light" />
            <span className="font-terminal text-sm text-ink font-medium">
              {recentSaves}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Domain */}
          <div className="flex items-center gap-1.5 text-ink-muted">
            <DomainFavicon domain={bookmark.domain} size={14} />
            <span className="font-terminal truncate max-w-[160px]">{bookmark.domain}</span>
          </div>

          {/* External link - visible on hover */}
          <Link
            href={bookmark.link || bookmark.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-muted opacity-0 group-hover:opacity-100 hover:text-ink transition-all"
            aria-label="Open link in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Curator count */}
        {bookmark.saved_by_users && bookmark.saved_by_users.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <Users className="w-3 h-3 text-ink-muted" />
            <span className="font-terminal text-xs text-ink-muted">
              saved by {bookmark.saved_by_users.length} curator{bookmark.saved_by_users.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
