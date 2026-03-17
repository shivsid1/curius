import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CategoryBadge } from '@/components/categories/CategoryBadge';
import { Bookmark } from 'lucide-react';
import type { CuratorProfile } from '@/lib/supabase';

interface CuratorCardProps {
  curator: CuratorProfile;
}

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

export function CuratorCard({ curator }: CuratorCardProps) {
  const displayName = curator.display_name
    || [curator.first_name, curator.last_name].filter(Boolean).join(' ')
    || curator.username;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="group py-4 border-b border-border/50 last:border-b-0 transition-colors hover:bg-cream-dark/40">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm shrink-0',
            getAvatarColor(curator.username)
          )}
        >
          {initial}
        </span>

        <div className="min-w-0">
          <Link
            href={`/u/${curator.username}`}
            className="font-serif text-[15px] font-medium text-ink hover:text-terminal-cyan transition-colors"
          >
            {displayName}
          </Link>
          <span className="font-terminal text-xs text-ink-muted ml-2">
            @{curator.username}
          </span>
        </div>

        <span className="flex items-center gap-1 ml-auto shrink-0 font-terminal text-xs text-ink-muted">
          <Bookmark className="w-3 h-3" />
          <span className="text-terminal-cyan font-medium">{curator.bookmark_count}</span>
        </span>
      </div>

      {curator.top_topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 ml-[44px]">
          {curator.top_topics.map((t) => (
            <CategoryBadge key={t.topic} topic={t.topic} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
