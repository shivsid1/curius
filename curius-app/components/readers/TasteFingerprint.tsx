import { cn } from '@/lib/utils';
import type { TasteFingerprintEntry } from '@/lib/supabase';

interface TasteFingerprintProps {
  fingerprint: TasteFingerprintEntry[] | null;
  size?: 'sm' | 'md';
  className?: string;
}

// Ink-bar opacity descends with rank: the fingerprint reads like layers of
// sediment, not a rainbow chart.
const BAR_OPACITY = ['opacity-100', 'opacity-70', 'opacity-45'];

export function TasteFingerprint({ fingerprint, size = 'md', className }: TasteFingerprintProps) {
  if (!fingerprint || fingerprint.length === 0) {
    return (
      <p className={cn('font-terminal text-xs text-ink-muted italic', className)}>
        Taste not yet catalogued
      </p>
    );
  }

  const isSm = size === 'sm';

  return (
    <div className={cn('space-y-1.5', className)}>
      {fingerprint.slice(0, 3).map((entry, idx) => (
        <div key={entry.topic}>
          <div className="flex items-baseline justify-between mb-0.5">
            <span className={cn('font-terminal text-ink', isSm ? 'text-[10px]' : 'text-xs')}>
              {entry.topic}
            </span>
            <span className={cn('font-terminal text-ink-muted', isSm ? 'text-[10px]' : 'text-xs')}>
              {entry.percentage}%
            </span>
          </div>
          <div className={cn('w-full bg-cream-dark rounded-sm overflow-hidden', isSm ? 'h-1' : 'h-1.5')}>
            <div
              className={cn('h-full bg-ink rounded-sm', BAR_OPACITY[idx] ?? 'opacity-45')}
              style={{ width: `${Math.min(100, Math.max(2, entry.percentage))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
