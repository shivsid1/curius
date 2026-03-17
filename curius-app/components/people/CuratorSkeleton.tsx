import { Skeleton } from '@/components/ui/skeleton';

export function CuratorSkeleton() {
  return (
    <div className="py-4 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="ml-auto">
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
      <div className="flex gap-1.5 mt-2 ml-[44px]">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function CuratorListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <CuratorSkeleton key={i} />
      ))}
    </div>
  );
}
