import { cn } from '@/lib/utils';

export function ReaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('frame-engraved rounded-lg bg-cream p-5 animate-pulse', className)}>
      <div className="h-4 w-36 bg-cream-dark rounded mb-4" />
      <div className="space-y-2.5 mb-4">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <div className="h-2.5 w-20 bg-cream-dark rounded" />
              <div className="h-2.5 w-8 bg-cream-dark rounded" />
            </div>
            <div className="h-1 w-full bg-cream-dark rounded" />
          </div>
        ))}
      </div>
      <div className="h-3 w-44 bg-cream-dark rounded" />
    </div>
  );
}

export function ReaderGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ReaderSkeleton key={i} />
      ))}
    </div>
  );
}
