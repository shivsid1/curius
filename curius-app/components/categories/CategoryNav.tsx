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

  const allExpanded = topics.length > 0 && topics.every(t => expandedTopics.has(t.topic));

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedTopics(new Set());
    } else {
      setExpandedTopics(new Set(topics.map(t => t.topic)));
    }
  };

  return (
    <nav>
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="font-serif text-xs font-semibold text-ink-muted uppercase tracking-[0.2em]">
          Topics
        </h2>
        {topics.length > 0 && (
          <button
            onClick={toggleAll}
            className="font-terminal text-[10px] text-ink-muted hover:text-ink transition-colors"
          >
            {allExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>

      <div className="space-y-3">
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
                'w-full flex items-center justify-between px-2 py-2 rounded-md transition-colors',
                'hover:bg-cream-dark',
                isSelected && 'bg-cream-dark'
              )}
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={cn(
                    'h-3 w-3 text-ink-muted transition-transform shrink-0',
                    isExpanded && 'rotate-90'
                  )}
                />
                <span className={cn(
                  'font-serif text-[15px] font-medium',
                  isSelected ? 'text-ink' : 'text-ink-light'
                )}>
                  {topic.topic}
                </span>
              </div>
              <span className="font-terminal text-[11px] text-ink-muted tabular-nums">
                {formatCount(topic.count)}
              </span>
            </button>

            {isExpanded && topic.subtopics.length > 0 && (
              <div className="ml-5 mt-1 space-y-0.5 border-l border-border/40 pl-3">
                {topic.subtopics.map((sub) => {
                  const isSubSelected =
                    selectedTopic === topic.topic && selectedSubtopic === sub.subtopic;

                  return (
                    <button
                      key={sub.subtopic}
                      onClick={() => onSelect(topic.topic, sub.subtopic)}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors',
                        'hover:bg-cream-dark/60',
                        isSubSelected && 'bg-cream-dark text-ink'
                      )}
                    >
                      <span className={cn(
                        'font-terminal text-[12px] truncate',
                        isSubSelected ? 'text-ink font-medium' : 'text-ink-muted'
                      )}>
                        {sub.subtopic}
                      </span>
                      <span className="font-terminal text-[10px] text-ink-muted ml-3 shrink-0 tabular-nums">
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
      </div>

      {topics.length === 0 && (
        <p className="font-terminal text-ink-muted px-3 py-2">
          No topics found
        </p>
      )}
    </nav>
  );
}
