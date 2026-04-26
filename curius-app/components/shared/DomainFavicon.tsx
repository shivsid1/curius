'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Globe } from 'lucide-react';

interface DomainFaviconProps {
  domain: string;
  size?: number;
  className?: string;
}

export function DomainFavicon({ domain, size = 16, className = '' }: DomainFaviconProps) {
  const [hasError, setHasError] = useState(false);

  const token = process.env.NEXT_PUBLIC_LOGODEV_KEY || 'pk_X-1ZO13GSgeOoUrIuJ6GMQ';
  const logoUrl = `https://img.logo.dev/${domain}?token=${token}`;

  if (hasError) {
    return (
      <Globe
        className={`text-ink-muted ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`${domain} favicon`}
      width={size}
      height={size}
      className={`rounded-sm ${className}`}
      onError={() => setHasError(true)}
      unoptimized
    />
  );
}
