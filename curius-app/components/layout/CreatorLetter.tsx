'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';

const SEEN_KEY = 'curius-atlas-welcome-seen';

function AtlasStamp() {
  return (
    <div className="flex justify-center mb-5">
      <Image
        src="/illustrations/seal.png"
        alt=""
        width={96}
        height={96}
        className="select-none"
        style={{ transform: 'rotate(-6deg)' }}
        priority
      />
    </div>
  );
}

export function CreatorLetter() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        setOpen(true);
        localStorage.setItem(SEEN_KEY, '1');
      }
    } catch {
      // localStorage blocked (private browsing, etc.) — silently skip
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="font-serif text-sm text-ink-light hover:text-ink transition-colors underline underline-offset-4 decoration-border hover:decoration-ink-muted">
          Why this exists
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl bg-cream border-border p-0 overflow-hidden">
        <div className="px-7 pt-6 pb-5">
          <AtlasStamp />

          <div className="space-y-3 font-serif text-sm text-ink-light leading-relaxed">
            <p>
              The internet is expanding like the universe — and most of what fills the new space
              is slop. Generated, optimized, published because it&apos;s cheap. The open web I
              grew up reading is getting harder to find.
            </p>

            <p>
              <a href="https://curius.app" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:text-ink-light">
                Curius
              </a>{' '}
              is a harbor in that. Six thousand people quietly saving things for themselves —
              essays, papers, half-remembered ideas. Nobody coordinating. Just humans leaving
              fingerprints on the corners of the internet that felt worth keeping.
            </p>

            <p>
              This is an atlas of those fingerprints. I hope you find something worth remembering.
            </p>

            <div className="pt-1">
              <p className="font-atlas text-ink text-base">Shivam</p>
              <p className="font-terminal text-xs text-ink-muted">Made with love from Austin, TX</p>
            </div>
          </div>
        </div>

        <div className="w-full overflow-hidden max-h-[110px] -mb-1">
          <Image
            src="/illustrations/austin.png"
            alt=""
            width={1024}
            height={1024}
            className="w-full object-cover object-center opacity-90"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
