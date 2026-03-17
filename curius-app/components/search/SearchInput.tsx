'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search for articles, papers, tools...',
  className,
  autoFocus = false,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'w-full h-12 pl-12 pr-10 font-serif text-base text-ink',
          'bg-cream-dark border border-border rounded-lg',
          'focus:border-ink-light focus:outline-none focus:ring-1 focus:ring-ink-light/20',
          'placeholder:text-ink-muted',
          'transition-colors'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-light transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
