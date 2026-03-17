import { DomainFavicon } from '@/components/shared/DomainFavicon';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { Bookmark, Users } from 'lucide-react';
import type { SourceStats } from '@/lib/supabase';

interface SourceCardProps {
  source: SourceStats;
}

export function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="group py-4 border-b border-border/50 last:border-b-0 transition-colors hover:bg-cream-dark/40">
      <div className="flex items-center gap-3">
        <DomainFavicon domain={source.domain} size={20} />

        <span className="font-serif text-[15px] font-medium text-ink truncate">
          {source.domain}
        </span>

        <div className="flex items-center gap-3 ml-auto shrink-0">
          <span className="flex items-center gap-1 font-terminal text-xs text-ink-muted">
            <Bookmark className="w-3 h-3" />
            <span className="text-terminal-cyan font-medium">{source.bookmark_count}</span>
          </span>
          <span className="flex items-center gap-1 font-terminal text-xs text-ink-muted">
            <Users className="w-3 h-3" />
            <span className="text-terminal-cyan font-medium">{source.total_saves}</span>
          </span>
        </div>
      </div>

      {source.top_topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 ml-[32px]">
          {source.top_topics.map((t) => (
            <CategoryBadge key={t.topic} topic={t.topic} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
