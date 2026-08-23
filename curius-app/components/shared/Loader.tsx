'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

type LoaderMode = 'rotate' | 'pulse' | 'oscillate';

interface LoaderProps {
  mode?: LoaderMode;
  size?: number;
  label?: string;
  className?: string;
}

const SIZES: Record<string, string> = {
  rotate: 'animate-loader-rotate',
  pulse: 'animate-loader-pulse',
  oscillate: 'animate-loader-oscillate',
};

export function Loader({
  mode = 'oscillate',
  size = 80,
  label = 'Loading...',
  className,
}: LoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Image
        src="/illustrations/thinking-head.png"
        alt=""
        width={size}
        height={size}
        className={cn('select-none opacity-90', SIZES[mode])}
        style={{ transformOrigin: 'center center' }}
        priority
      />
      {label && (
        <span className="font-terminal text-xs text-ink-muted">{label}</span>
      )}
    </div>
  );
}
