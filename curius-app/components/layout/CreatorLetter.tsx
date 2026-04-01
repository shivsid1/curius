'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';

export function CreatorLetter() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="font-serif text-sm text-ink-light hover:text-ink transition-colors underline underline-offset-4 decoration-border hover:decoration-ink-muted">
          Why this exists
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl bg-cream border-border p-0 overflow-hidden">
        {/* Letter */}
        <div className="px-8 pt-10 pb-8">
          {/* Compass watermark */}
          <div className="flex justify-center mb-6">
            <Image
              src="/illustrations/compass.png"
              alt=""
              width={64}
              height={64}
              className="opacity-60"
            />
          </div>

          <div className="space-y-5 font-serif text-[15px] text-ink-light leading-relaxed">
            <p>
              The internet is getting noisier. Algorithms feed us the same popular content.
              AI-generated slop floods every feed. The signal-to-noise ratio gets worse every year.
            </p>

            <p>
              But somewhere, quietly, thousands of curious people are still finding remarkable things
              and saving them to <a href="https://curius.app" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:text-ink-light">Curius</a>.
              Essays that change how you think. Papers that push a field forward.
              Tools that deserve more attention. The kind of content that algorithms bury
              because it doesn&apos;t optimize for clicks.
            </p>

            <p>
              Most of this lives in the long tail. Niche, obscure, saved by one or two people
              who happened to stumble on it. Invisible to everyone else.
            </p>

            <p>
              I built Curius Atlas to make that visible. To catalog what curious people actually read,
              surface the patterns, and give the long tail a chance to be found. Not through an algorithm,
              but through the collective taste of 5,000+ people who care enough to save what they find.
            </p>

            <p>
              Think of it as an atlas of human curiosity. The internet isn&apos;t dead yet.
              You just have to know where to look.
            </p>

            <p className="font-atlas text-ink text-lg pt-2">
              Shiv
            </p>
          </div>
        </div>

        {/* Bottom illustration */}
        <div className="w-full -mb-1">
          <Image
            src="/illustrations/sf.png"
            alt=""
            width={600}
            height={200}
            className="w-full opacity-40"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
