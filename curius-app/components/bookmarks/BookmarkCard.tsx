'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainFavicon } from '@/components/shared/DomainFavicon';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { UserChipGroup } from '@/components/users/UserChip';
import type { Bookmark } from '@/lib/supabase';

interface BookmarkTag {
  topic: string;
  subtopic?: string;
}

interface BookmarkWithMeta extends Bookmark {
  tags?: BookmarkTag[];
  saved_by_users?: string[];
}

interface BookmarkCardProps {
  bookmark: BookmarkWithMeta;
  variant?: 'compact' | 'expanded';
  showUsers?: boolean;
  className?: string;
}

export function BookmarkCard({
  bookmark,
  variant = 'compact',
  showUsers = false,
  className,
}: BookmarkCardProps) {
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
        'hover:shadow-md hover:border-ink-light/30',
        isHovered && 'border-l-ink-light',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left accent border */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-colors',
          isHovered ? 'bg-ink-light' : 'bg-transparent'
        )}
      />

      <div className="p-4 pl-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
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
          <Link
            href={bookmark.link || bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1 text-ink-muted hover:text-ink-light transition-colors"
            aria-label="Open link in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        {/* Meta row: domain, category, stats */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {/* Domain with favicon */}
          <div className="flex items-center gap-1.5 font-terminal text-ink-muted">
            <DomainFavicon domain={bookmark.domain} size={14} />
            <span className="truncate max-w-[150px]">{bookmark.domain}</span>
          </div>

          {/* Category badge */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <CategoryBadge
              topic={bookmark.tags[0].topic}
              subtopic={bookmark.tags[0].subtopic}
              size="sm"
            />
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 ml-auto font-terminal text-xs text-ink-muted">
            {bookmark.saves_count > 1 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span className="text-terminal-cyan">{bookmark.saves_count}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(bookmark.created_at)}
            </span>
          </div>
        </div>

        {/* Expanded: Show users who saved this */}
        {variant === 'expanded' && showUsers && bookmark.saved_by_users && bookmark.saved_by_users.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cream-border">
            <div className="flex items-center gap-2">
              <span className="font-terminal text-xs text-ink-muted">Saved by:</span>
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
