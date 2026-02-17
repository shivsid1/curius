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

  // Use logo.dev API for brand logos
  const logoUrl = `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ`;

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
