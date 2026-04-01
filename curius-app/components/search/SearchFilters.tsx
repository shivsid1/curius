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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-6">
      <button
        onClick={() => onTopicChange(null)}
        className={cn(
          'relative py-1.5 font-terminal text-sm transition-colors',
          !selectedTopic
            ? 'text-ink font-medium'
            : 'text-ink-muted hover:text-ink'
        )}
      >
        All
        {!selectedTopic && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink rounded-full" />
        )}
      </button>

      {topics.map((topic) => (
        <button
          key={topic}
          onClick={() => onTopicChange(topic === selectedTopic ? null : topic)}
          className={cn(
            'relative py-1.5 font-terminal text-sm transition-colors',
            selectedTopic === topic
              ? 'text-ink font-medium'
              : 'text-ink-muted hover:text-ink'
          )}
        >
          {topic}
          {selectedTopic === topic && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
