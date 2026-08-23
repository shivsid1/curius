'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';

// Shared email capture. Placed inline on pages with infinite scroll, where
// the footer version is effectively unreachable.
export function EmailSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitted'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // Placeholder: store locally until a real list provider is wired up.
    try {
      const existing = JSON.parse(
        localStorage.getItem('curius-atlas-digest-emails') || '[]'
      ) as string[];
      if (!existing.includes(email)) existing.push(email);
      localStorage.setItem('curius-atlas-digest-emails', JSON.stringify(existing));
    } catch {
      // ignore
    }
    setStatus('submitted');
  };

  if (status === 'submitted') {
    return (
      <p className="font-serif text-sm text-ink-light">
        Thanks. The first digest will arrive on Sunday.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-sm">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@somewhere.com"
        className="flex-1 bg-cream border border-cream-border rounded px-3 py-2 font-serif text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-ink-light transition-colors"
      />
      <button
        type="submit"
        className="bg-ink text-cream px-4 py-2 rounded font-terminal text-xs tracking-wide hover:bg-ink-light transition-colors"
      >
        Subscribe
      </button>
    </form>
  );
}

// Slim inline banner for the Trending page: the digest IS trending, weekly.
export function DigestCallout() {
  return (
    <aside className="frame-engraved rounded-lg bg-cream-dark/30 px-5 py-4 my-4">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-[220px]">
          <p className="flex items-center gap-1.5 font-terminal text-[10px] uppercase tracking-wider text-ink-muted mb-1">
            <Mail className="w-3 h-3" />
            The Sunday digest
          </p>
          <p className="font-serif text-sm text-ink">
            The five most converged links each week, in one email.
          </p>
        </div>
        <EmailSignup />
      </div>
    </aside>
  );
}
