import { Skeleton } from '@/components/ui/skeleton';

export function SourceSkeleton() {
  return (
    <div className="py-4 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-3">
        <Skeleton className="w-5 h-5 rounded-sm" />
        <Skeleton className="h-5 w-40" />
        <div className="flex items-center gap-3 ml-auto">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
      <div className="flex gap-1.5 mt-2 ml-[32px]">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function SourceListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <SourceSkeleton key={i} />
      ))}
    </div>
  );
}
