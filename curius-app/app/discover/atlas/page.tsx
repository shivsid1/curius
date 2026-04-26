'use client';

import { TasteMap } from '@/components/viz/TasteMap';
import { LongTail } from '@/components/viz/LongTail';
import { Zeitgeist } from '@/components/viz/Zeitgeist';

export default function AtlasPage() {
  return (
    <div className="space-y-16">
      {/* Taste Map */}
      <section>
        <h2 className="font-atlas text-2xl text-ink mb-2">The Taste Map</h2>
        <p className="font-serif text-sm text-ink-muted mb-6 max-w-xl">
          Domains connected by shared readers. Hover a node to see what else its readers save.
          Drag to rearrange. Scroll to zoom.
        </p>
        <TasteMap />
      </section>

      {/* Long Tail */}
      <section>
        <h2 className="font-atlas text-2xl text-ink mb-2">The Long Tail</h2>
        <p className="font-serif text-sm text-ink-muted mb-6 max-w-xl">
          Most bookmarks are saved by a single person. The best finds live in the tail,
          not the head. Click a point to explore.
        </p>
        <LongTail />
      </section>

      {/* Zeitgeist */}
      <section>
        <h2 className="font-atlas text-2xl text-ink mb-2">Reading Zeitgeist</h2>
        <p className="font-serif text-sm text-ink-muted mb-6 max-w-xl">
          How collective attention shifts over time. What the community reads, month by month.
        </p>
        <Zeitgeist />
      </section>
    </div>
  );
}
