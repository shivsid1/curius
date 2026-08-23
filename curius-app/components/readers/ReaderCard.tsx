import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TasteFingerprint } from '@/components/readers/TasteFingerprint';
import type { ReaderMatch } from '@/lib/supabase';

interface ReaderCardProps {
  reader: ReaderMatch;
  // Twin context: show the overlap with the visitor's own taste.
  matchLabel?: string;
  className?: string;
}

// The specimen-label card: a reader is a catalogue number, a taste, a shelf.
export function ReaderCard({ reader, matchLabel, className }: ReaderCardProps) {
  return (
    <article
      className={cn(
        'frame-engraved rounded-lg bg-cream p-5 hover-lift transition-colors',
        className
      )}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <Link
          href={`/reader/${reader.reader_no}`}
          className="group inline-flex items-baseline gap-2"
        >
          <h3 className="font-cartographic text-sm text-ink tracking-widest group-hover:text-ink-light transition-colors">
            READER N&ordm; {reader.reader_no}
          </h3>
          <ArrowRight className="w-3 h-3 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity self-center" />
        </Link>
        {matchLabel && (
          <span className="shrink-0 font-terminal text-[11px] px-2 py-0.5 rounded-md bg-ink text-cream">
            {matchLabel}
          </span>
        )}
      </header>

      <TasteFingerprint fingerprint={reader.taste_fingerprint} size="sm" className="mb-3" />

      <p className="flex items-center gap-1.5 font-terminal text-xs text-ink-muted">
        <BookOpen className="w-3 h-3" />
        {reader.bookmark_count.toLocaleString()} bookmarks catalogued
        {typeof reader.shared_bookmarks === 'number' && (
          <span>&middot; {reader.shared_bookmarks} shared with you</span>
        )}
      </p>

      {reader.sample_bookmarks && reader.sample_bookmarks.length > 0 && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <p className="font-terminal text-[10px] uppercase tracking-wider text-ink-muted mb-2">
            From their shelf
          </p>
          <ul className="space-y-1.5">
            {reader.sample_bookmarks.map((b) => (
              <li key={b.url} className="leading-snug">
                <Link
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-scholarly text-sm text-ink hover:text-ink-light underline-offset-2 hover:underline"
                >
                  {b.title || b.url}
                </Link>
                {b.domain && (
                  <span className="font-terminal text-[11px] text-ink-muted ml-2">
                    {b.domain}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={`/reader/${reader.reader_no}`}
        className="mt-3 inline-flex items-center gap-1 font-terminal text-xs text-ink-light hover:text-ink underline-offset-2 hover:underline"
      >
        Open their catalogue
        <ArrowRight className="w-3 h-3" />
      </Link>
    </article>
  );
}
