import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  topic: string;
  subtopic?: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'outline' | 'filled';
  className?: string;
  onClick?: () => void;
}

export function CategoryBadge({
  topic,
  subtopic,
  size = 'sm',
  variant = 'default',
  className,
  onClick,
}: CategoryBadgeProps) {
  const isClickable = !!onClick;

  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
  };

  const variantClasses = {
    default: 'bg-accent text-ink-light',
    outline: 'bg-transparent text-ink-muted border border-border hover:border-ink-light',
    filled: 'bg-ink text-cream',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-terminal rounded-md transition-colors',
        sizeClasses[size],
        variantClasses[variant],
        isClickable && 'cursor-pointer hover:bg-accent/80',
        className
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <span>{topic}</span>
      {subtopic && (
        <>
          <span className="text-ink-muted/60">/</span>
          <span className="text-ink-muted">{subtopic}</span>
        </>
      )}
    </span>
  );
}
