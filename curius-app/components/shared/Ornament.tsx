import { cn } from '@/lib/utils';

interface OrnamentProps {
  variant: 'rule' | 'divider' | 'flourish';
  className?: string;
}

export function Ornament({ variant, className }: OrnamentProps) {
  if (variant === 'rule') {
    return (
      <div className={cn('flex items-center gap-3 w-full', className)}>
        <div className="flex-1 h-px bg-ink/10" />
        <svg width="20" height="8" viewBox="0 0 20 8" fill="none" className="text-ink/20 shrink-0">
          <path d="M0 4h6M14 4h6M10 0l-3 4 3 4 3-4-3-4z" stroke="currentColor" strokeWidth="0.75" fill="currentColor" fillOpacity="0.3" />
        </svg>
        <div className="flex-1 h-px bg-ink/10" />
      </div>
    );
  }

  if (variant === 'divider') {
    return (
      <div className={cn('flex items-center gap-2 w-full', className)}>
        <div className="flex-1 h-px bg-ink/8" />
        <svg width="40" height="10" viewBox="0 0 40 10" fill="none" className="text-ink/15 shrink-0">
          <path d="M0 5h12M28 5h12" stroke="currentColor" strokeWidth="0.5" />
          <path d="M15 5a5 5 0 0 1 10 0M15 5a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="0.75" fill="none" />
          <circle cx="20" cy="5" r="1" fill="currentColor" />
        </svg>
        <div className="flex-1 h-px bg-ink/8" />
      </div>
    );
  }

  if (variant === 'flourish') {
    return (
      <svg width="60" height="16" viewBox="0 0 60 16" fill="none" className={cn('text-ink/15', className)}>
        <path d="M0 8c8-6 12-6 20 0s12 6 20 0 12-6 20 0" stroke="currentColor" strokeWidth="0.75" fill="none" />
        <circle cx="30" cy="8" r="1.5" fill="currentColor" fillOpacity="0.4" />
      </svg>
    );
  }

  return null;
}

interface CornerFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function CornerFrame({ children, className }: CornerFrameProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Corner marks */}
      <svg className="absolute top-0 left-0 w-3 h-3 text-ink/15" viewBox="0 0 12 12" fill="none">
        <path d="M0 12V0h12" stroke="currentColor" strokeWidth="0.75" />
      </svg>
      <svg className="absolute top-0 right-0 w-3 h-3 text-ink/15" viewBox="0 0 12 12" fill="none">
        <path d="M12 12V0H0" stroke="currentColor" strokeWidth="0.75" />
      </svg>
      <svg className="absolute bottom-0 left-0 w-3 h-3 text-ink/15" viewBox="0 0 12 12" fill="none">
        <path d="M0 0v12h12" stroke="currentColor" strokeWidth="0.75" />
      </svg>
      <svg className="absolute bottom-0 right-0 w-3 h-3 text-ink/15" viewBox="0 0 12 12" fill="none">
        <path d="M12 0v12H0" stroke="currentColor" strokeWidth="0.75" />
      </svg>
      {children}
    </div>
  );
}
