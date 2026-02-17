'use client';

import { Input } from '@/components/ui/input';
import { Clock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConvergenceFiltersProps {
  days: number;
  onDaysChange: (value: number) => void;
  domain: string;
  onDomainChange: (value: string) => void;
  totalResults?: number;
}

const TIME_OPTIONS = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 365, label: '1y' },
  { value: 9999, label: 'All' },
];

export function ConvergenceFilters({
  days,
  onDaysChange,
  domain,
  onDomainChange,
  totalResults,
}: ConvergenceFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-6 p-4 bg-card border border-border rounded-lg shadow-paper mb-6">
      {/* Time window selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-ink-muted" />
          <span className="font-terminal text-xs text-ink-muted whitespace-nowrap">
            Trending in:
          </span>
        </div>
        <div className="flex gap-1">
          {TIME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onDaysChange(option.value)}
              className={cn(
                'px-3 py-1 font-terminal text-sm rounded-md transition-colors',
                days === option.value
                  ? 'bg-terminal-cyan text-white'
                  : 'bg-cream-dark text-ink-muted hover:text-ink hover:bg-cream-border'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Domain filter */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <Globe className="w-4 h-4 text-ink-muted" />
        <Input
          type="text"
          placeholder="Filter by domain..."
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          className="h-8 font-terminal text-sm bg-cream-dark border-cream-border placeholder:text-ink-muted"
        />
      </div>

      {/* Results count */}
      {totalResults !== undefined && (
        <div className="font-terminal text-xs text-ink-muted ml-auto">
          <span className="text-terminal-cyan">{totalResults.toLocaleString()}</span> trending
        </div>
      )}
    </div>
  );
}
