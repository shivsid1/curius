'use client';

import { cn } from '@/lib/utils';
import { getAllCategories } from '@/lib/utils/taxonomy';

interface SearchFiltersProps {
  selectedTopic: string | null;
  onTopicChange: (topic: string | null) => void;
}

export function SearchFilters({ selectedTopic, onTopicChange }: SearchFiltersProps) {
  const topics = getAllCategories();

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {/* All topics chip */}
      <button
        onClick={() => onTopicChange(null)}
        className={cn(
          'px-3 py-1.5 text-sm font-terminal rounded-full border transition-colors',
          !selectedTopic
            ? 'bg-ink text-cream border-ink'
            : 'bg-transparent text-ink-muted border-cream-border hover:border-ink-light hover:text-ink-light'
        )}
      >
        All
      </button>

      {/* Topic chips */}
      {topics.map((topic) => (
        <button
          key={topic}
          onClick={() => onTopicChange(topic === selectedTopic ? null : topic)}
          className={cn(
            'px-3 py-1.5 text-sm font-terminal rounded-full border transition-colors',
            selectedTopic === topic
              ? 'bg-ink text-cream border-ink'
              : 'bg-transparent text-ink-muted border-cream-border hover:border-ink-light hover:text-ink-light'
          )}
        >
          {topic}
        </button>
      ))}
    </div>
  );
}
