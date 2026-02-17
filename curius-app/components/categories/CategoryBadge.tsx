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
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  const variantClasses = {
    default: 'bg-cream-dark text-ink-light border-cream-border',
    outline: 'bg-transparent text-ink-muted border-cream-border hover:border-ink-light',
    filled: 'bg-ink text-cream border-ink',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-terminal border rounded-md transition-colors',
        sizeClasses[size],
        variantClasses[variant],
        isClickable && 'cursor-pointer hover:bg-cream-dark/80',
        className
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <span className="font-medium">{topic}</span>
      {subtopic && (
        <>
          <span className="text-ink-muted">/</span>
          <span className="text-ink-muted">{subtopic}</span>
        </>
      )}
    </span>
  );
}
