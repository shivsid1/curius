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
      <div className="flex items-center gap-4">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-cream-dark/60 border border-border/40 flex items-center justify-center overflow-hidden">
          <DomainFavicon domain={source.domain} size={28} />
        </div>

        <div className="flex-1 min-w-0">
          <span className="font-serif text-[15px] font-medium text-ink truncate block">
            {source.domain}
          </span>
          {source.top_topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {source.top_topics.map((t) => (
                <CategoryBadge key={t.topic} topic={t.topic} size="sm" />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 ml-auto shrink-0">
          <span className="flex items-center gap-1.5 font-terminal text-xs text-ink-muted">
            <Bookmark className="w-3.5 h-3.5" />
            <span className="text-ink font-medium">{source.bookmark_count}</span>
          </span>
          <span className="flex items-center gap-1.5 font-terminal text-xs text-ink-muted">
            <Users className="w-3.5 h-3.5" />
            <span className="text-ink font-medium">{source.total_saves}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
