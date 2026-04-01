'use client';

import Link from 'next/link';
import { ExternalLink, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainFavicon } from '@/components/shared/DomainFavicon';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import type { Bookmark } from '@/lib/supabase';

interface BookmarkTag {
  topic: string;
  subtopic?: string;
}

interface BookmarkWithMeta extends Bookmark {
  tags?: BookmarkTag[];
  saved_by_users?: string[];
  first_saved_at?: string;
  first_saved_by?: string;
}

interface BookmarkCardProps {
  bookmark: BookmarkWithMeta;
  variant?: 'compact' | 'expanded';
  showUsers?: boolean;
  className?: string;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BookmarkCard({
  bookmark,
  variant = 'compact',
  showUsers = false,
  className,
}: BookmarkCardProps) {
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
          {/* Domain */}
          <div className="flex items-center gap-1.5 text-ink-muted">
            <DomainFavicon domain={bookmark.domain} size={14} />
            <span className="font-terminal truncate max-w-[160px]">{bookmark.domain}</span>
          </div>

          {/* Category */}
          {bookmark.tags && bookmark.tags.length > 0 && (
            <CategoryBadge
              topic={bookmark.tags[0].topic}
              subtopic={bookmark.tags[0].subtopic}
              size="sm"
            />
          )}

          {/* First saved */}
          {bookmark.first_saved_at && (
            <span className="font-terminal text-ink-muted">
              {formatRelativeDate(bookmark.first_saved_at)}
            </span>
          )}

          {/* Saves */}
          {bookmark.saves_count > 1 && (
            <span className="flex items-center gap-1 ml-auto font-terminal text-ink-muted">
              <Users className="w-3 h-3" />
              <span className="text-ink font-medium">{bookmark.saves_count}</span>
            </span>
          )}
        </div>

        {/* Expanded: anonymous curator count */}
        {variant === 'expanded' && showUsers && bookmark.saved_by_users && bookmark.saved_by_users.length > 0 && (
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
