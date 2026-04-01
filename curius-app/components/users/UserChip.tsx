import Link from 'next/link';
import { cn } from '@/lib/utils';

interface UserChipProps {
  username: string;
  displayName?: string;
  size?: 'sm' | 'md';
  showAvatar?: boolean;
  className?: string;
}

export function UserChip({
  username,
  displayName,
  size = 'sm',
  showAvatar = true,
  className,
}: UserChipProps) {
  const sizeClasses = {
    sm: 'text-xs h-6',
    md: 'text-sm h-8',
  };

  const avatarSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-50 text-blue-900',
      'bg-indigo-50 text-indigo-900',
      'bg-sky-50 text-sky-900',
      'bg-slate-100 text-slate-800',
      'bg-blue-100 text-blue-800',
      'bg-indigo-100 text-indigo-800',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const initial = (displayName || username).charAt(0).toUpperCase();

  return (
    <Link
      href={`/u/${username}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 rounded-full border border-cream-border bg-cream-light hover:bg-cream-dark transition-colors font-terminal',
        sizeClasses[size],
        className
      )}
    >
      {showAvatar && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full font-medium',
            avatarSizes[size],
            getAvatarColor(username)
          )}
        >
          {initial}
        </span>
      )}
      <span className="text-ink-light">@{username}</span>
    </Link>
  );
}

interface UserChipGroupProps {
  users: Array<{ username: string; displayName?: string }>;
  maxDisplay?: number;
  size?: 'sm' | 'md';
}

export function UserChipGroup({ users, maxDisplay = 3, size = 'sm' }: UserChipGroupProps) {
  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {displayUsers.map((user) => (
        <UserChip
          key={user.username}
          username={user.username}
          displayName={user.displayName}
          size={size}
        />
      ))}
      {remainingCount > 0 && (
        <span className="font-terminal text-xs text-ink-muted px-2">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
