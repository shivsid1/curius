'use client';

import Link from 'next/link';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DomainFavicon } from '@/components/shared/DomainFavicon';
import type { BookmarkConvergence } from '@/lib/supabase';

interface ConvergenceFeaturedCardProps {
  bookmark: BookmarkConvergence;
  days: number;
  className?: string;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ConvergenceFeaturedCard({
  bookmark,
  days,
  className,
}: ConvergenceFeaturedCardProps) {
  const recentSaves =
    (bookmark as BookmarkConvergence & { recent_saves?: number }).recent_saves ||
    bookmark.saves_count;
  const title =
    (bookmark as BookmarkConvergence & { title_en?: string }).title_en ||
    bookmark.title ||
    'Untitled';

  const savedAt = bookmark.saved_at_dates ?? [];
  const visibleDates = savedAt.slice(0, 6);
  const extraCount = savedAt.length - visibleDates.length;
  const dayLabel = days === 1 ? 'day' : 'days';
  const saveLabel = recentSaves === 1 ? 'save' : 'saves';
  const href = bookmark.link || bookmark.url || '#';

  return (
    <article
      className={cn(
        'group relative frame-engraved bg-cream-dark/30 rounded-md p-6 md:p-7 mb-4 transition-colors',
        'hover:bg-cream-dark/50',
        className
      )}
    >
      {/* Hero badge */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="inline-flex items-center gap-1.5 font-terminal text-[10px] uppercase tracking-[0.18em] text-ink-light bg-cream border border-border/70 rounded-full px-2.5 py-1">
          <TrendingUp className="w-3 h-3" />
          Most converged this week
        </span>

        {/* Velocity stat */}
        <div className="shrink-0 text-right">
          <div className="font-terminal text-2xl md:text-3xl font-medium text-ink leading-none">
            {recentSaves}
          </div>
          <div className="font-terminal text-[10px] uppercase tracking-wider text-ink-muted mt-1">
            {saveLabel} in {days} {dayLabel}
          </div>
        </div>
      </div>

      {/* Title */}
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group/link block"
      >
        <h2 className="font-serif text-xl md:text-2xl font-medium text-ink leading-tight tracking-tight group-hover/link:text-ink-light transition-colors">
          {title}
        </h2>
      </Link>

      {/* Domain row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 text-ink-light">
          <DomainFavicon domain={bookmark.domain} size={20} />
          <span className="font-terminal text-sm truncate max-w-[260px]">
            {bookmark.domain}
          </span>
        </div>

        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-terminal text-xs text-ink-muted hover:text-ink transition-colors"
          aria-label="Open link in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open</span>
        </Link>
      </div>

      {/* Save timestamps */}
      {visibleDates.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border/50 flex flex-wrap items-center gap-1.5">
          <span className="font-terminal text-[10px] text-ink-muted uppercase tracking-wider mr-1">
            saved
          </span>
          {visibleDates.map((d, i) => (
            <span
              key={i}
              className="font-terminal text-[10px] text-ink-muted bg-cream border border-border/60 rounded px-1.5 py-0.5"
            >
              {formatRelativeDate(d)}
            </span>
          ))}
          {extraCount > 0 && (
            <span className="font-terminal text-[10px] text-ink-muted">
              +{extraCount} more
            </span>
          )}
        </div>
      )}
    </article>
  );
}
