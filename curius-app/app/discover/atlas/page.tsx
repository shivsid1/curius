'use client';

import { TasteMap } from '@/components/viz/TasteMap';
import { LongTail } from '@/components/viz/LongTail';
import { Zeitgeist } from '@/components/viz/Zeitgeist';

export default function AtlasPage() {
  return (
    <div className="space-y-20">
      {/* Hero: Taste Map */}
      <section>
        <header className="mb-8 max-w-2xl">
          <h1 className="font-atlas text-4xl text-ink mb-3 leading-tight">Atlas</h1>
          <p className="font-serif text-base text-ink-light mb-4">
            A map of what curious people read.
          </p>
          <p className="font-serif text-sm text-ink-muted">
            Domains connected by shared readers. Hover a node to see what else its readers save.
            Drag to rearrange. Scroll to zoom.
          </p>
        </header>
        <TasteMap />
      </section>

      {/* Secondary: supporting evidence */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="font-atlas text-xl text-ink mb-2">The Long Tail</h2>
            <p className="font-serif text-sm text-ink-muted mb-6">
              Most bookmarks are saved by a single person. The best finds live in the tail.
            </p>
            <LongTail />
          </div>

          <div>
            <h2 className="font-atlas text-xl text-ink mb-2">Reading Zeitgeist</h2>
            <p className="font-serif text-sm text-ink-muted mb-6">
              How collective attention shifts month by month.
            </p>
            <Zeitgeist />
          </div>
        </div>
      </section>
    </div>
  );
}
