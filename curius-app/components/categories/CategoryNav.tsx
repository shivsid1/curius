'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopicStats } from '@/lib/supabase';

interface CategoryNavProps {
  topics: TopicStats[];
  selectedTopic?: string | null;
  selectedSubtopic?: string | null;
  onSelect: (topic: string, subtopic?: string) => void;
}

export function CategoryNav({
  topics,
  selectedTopic,
  selectedSubtopic,
  onSelect,
}: CategoryNavProps) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(
    new Set(selectedTopic ? [selectedTopic] : [])
  );

  const toggleExpand = (topic: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topic)) {
      newExpanded.delete(topic);
    } else {
      newExpanded.add(topic);
    }
    setExpandedTopics(newExpanded);
  };

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <nav className="space-y-0.5">
      <h2 className="font-serif text-sm font-semibold text-ink mb-3 px-2 uppercase tracking-widest">
        Topics
      </h2>

      {topics.map((topic) => {
        const isExpanded = expandedTopics.has(topic.topic);
        const isSelected = selectedTopic === topic.topic && !selectedSubtopic;

        return (
          <div key={topic.topic}>
            <button
              onClick={() => {
                toggleExpand(topic.topic);
                onSelect(topic.topic);
              }}
              className={cn(
                'w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors text-sm',
                'hover:bg-cream-dark',
                isSelected && 'bg-cream-dark font-medium'
              )}
            >
              <div className="flex items-center gap-1.5">
                <ChevronRight
                  className={cn(
                    'h-3.5 w-3.5 text-ink-muted transition-transform',
                    isExpanded && 'rotate-90'
                  )}
                />
                <span className={cn(
                  'font-serif',
                  isSelected ? 'text-ink' : 'text-ink-light'
                )}>
                  {topic.topic}
                </span>
              </div>
              <span className="font-terminal text-ink-muted">
                {formatCount(topic.count)}
              </span>
            </button>

            {isExpanded && topic.subtopics.length > 0 && (
              <div className="ml-5 mt-0.5 space-y-0 border-l border-border/60 pl-3">
                {topic.subtopics.map((sub) => {
                  const isSubSelected =
                    selectedTopic === topic.topic && selectedSubtopic === sub.subtopic;

                  return (
                    <button
                      key={sub.subtopic}
                      onClick={() => onSelect(topic.topic, sub.subtopic)}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1 rounded-md transition-colors',
                        'hover:bg-cream-dark/60',
                        isSubSelected && 'bg-cream-dark text-ink'
                      )}
                    >
                      <span className={cn(
                        'font-terminal truncate',
                        isSubSelected ? 'text-ink font-medium' : 'text-ink-muted'
                      )}>
                        {sub.subtopic}
                      </span>
                      <span className="font-terminal text-ink-muted/60 ml-2">
                        {formatCount(sub.count)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {topics.length === 0 && (
        <p className="font-terminal text-ink-muted px-3 py-2">
          No topics found
        </p>
      )}
    </nav>
  );
}
