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
    <nav className="space-y-1">
      <h2 className="font-handwritten text-xl text-ink mb-4 px-2">Topics</h2>

      {topics.map((topic) => {
        const isExpanded = expandedTopics.has(topic.topic);
        const isSelected = selectedTopic === topic.topic && !selectedSubtopic;

        return (
          <div key={topic.topic} className="group">
            {/* Topic header */}
            <button
              onClick={() => {
                toggleExpand(topic.topic);
                onSelect(topic.topic);
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors',
                'hover:bg-cream-dark/50',
                isSelected && 'bg-cream-dark border-l-2 border-ink-light'
              )}
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={cn(
                    'h-4 w-4 text-ink-muted transition-transform',
                    isExpanded && 'rotate-90'
                  )}
                />
                <span
                  className={cn(
                    'font-scholarly text-sm',
                    isSelected ? 'text-ink font-medium' : 'text-ink-light'
                  )}
                >
                  {topic.topic}
                </span>
              </div>
              <span className="font-terminal text-xs text-ink-muted">
                {formatCount(topic.count)}
              </span>
            </button>

            {/* Subtopics */}
            {isExpanded && topic.subtopics.length > 0 && (
              <div className="ml-6 mt-1 space-y-0.5 border-l border-cream-border pl-3">
                {topic.subtopics.map((sub) => {
                  const isSubSelected =
                    selectedTopic === topic.topic && selectedSubtopic === sub.subtopic;

                  return (
                    <button
                      key={sub.subtopic}
                      onClick={() => onSelect(topic.topic, sub.subtopic)}
                      className={cn(
                        'w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors text-sm',
                        'hover:bg-cream-dark/30',
                        isSubSelected && 'bg-cream-dark text-ink font-medium'
                      )}
                    >
                      <span
                        className={cn(
                          'font-terminal text-xs truncate',
                          isSubSelected ? 'text-ink' : 'text-ink-muted'
                        )}
                      >
                        {sub.subtopic}
                      </span>
                      <span className="font-terminal text-xs text-ink-muted/70 ml-2">
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
        <p className="font-terminal text-xs text-ink-muted px-3 py-2">
          No topics found
        </p>
      )}
    </nav>
  );
}
