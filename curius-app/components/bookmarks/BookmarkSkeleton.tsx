import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface BookmarkSkeletonProps {
  variant?: 'compact' | 'expanded';
  className?: string;
}

export function BookmarkSkeleton({ variant = 'compact', className }: BookmarkSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-4 shadow-paper',
        className
      )}
    >
      {/* Title skeleton */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 space-y-1">
          <Skeleton className="h-5 w-full max-w-[300px]" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>

      {/* Meta row skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-20 rounded-md" />
        <div className="flex items-center gap-2 ml-auto">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Expanded: Users skeleton */}
      {variant === 'expanded' && (
        <div className="mt-3 pt-3 border-t border-cream-border">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-1">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BookmarkListSkeletonProps {
  count?: number;
  variant?: 'compact' | 'expanded';
}

export function BookmarkListSkeleton({ count = 5, variant = 'compact' }: BookmarkListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <BookmarkSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}
