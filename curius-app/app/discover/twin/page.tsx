'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimilarUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  bookmark_count: number;
  shared_bookmarks: number;
  affinity: number;
}

interface SimilarResponse {
  user: { username: string; first_name: string | null; last_name: string | null; bookmark_count: number };
  seedBookmarks: number;
  results: SimilarUser[];
}

function fullName(u: { first_name?: string | null; last_name?: string | null; username: string }) {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return name || u.username;
}

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-50 text-blue-900',
    'bg-indigo-50 text-indigo-900',
    'bg-sky-50 text-sky-900',
    'bg-slate-100 text-slate-800',
    'bg-blue-100 text-blue-800',
    'bg-indigo-100 text-indigo-800',
  ];
  const index = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[index % colors.length];
};

export default function TwinPage() {
  const [input, setInput] = useState('');
  const [data, setData] = useState<SimilarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedUsername, setSubmittedUsername] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const username = input.trim().toLowerCase();
    if (!username) return;

    setLoading(true);
    setError(null);
    setData(null);
    setSubmittedUsername(username);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/similar`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || 'Something went wrong');
      } else {
        setData(body);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ink-light" />
            Find your twins
          </h1>
          <p className="font-scholarly text-sm text-ink-muted">
            Enter your Curius username to find curators with overlapping taste.
          </p>
        </div>
        <Image
          src="/illustrations/scholar.png"
          alt=""
          width={96}
          height={96}
          className="opacity-60 shrink-0 hidden md:block"
        />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-8">
        <span className="font-terminal text-sm text-ink-muted">curius.app/</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="your-username"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 font-terminal text-sm bg-transparent border-b border-border/60 focus:border-ink outline-none py-2 px-1 placeholder:text-ink-muted/60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-md font-terminal text-sm transition-colors',
            loading || !input.trim()
              ? 'bg-cream-dark text-ink-muted cursor-not-allowed'
              : 'bg-ink text-cream hover:bg-ink-light'
          )}
        >
          {loading ? 'Finding...' : 'Find'}
          {!loading && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </form>

      {error && (
        <div className="border border-border rounded-md p-4 bg-cream-dark/30">
          <p className="font-serif text-sm text-ink">{error}</p>
          {error.toLowerCase().includes('no curius user') && (
            <p className="font-terminal text-xs text-ink-muted mt-1">
              Make sure you typed it exactly as it appears in your Curius profile URL.
            </p>
          )}
        </div>
      )}

      {data && data.results.length === 0 && !error && (
        <div className="border border-border rounded-md p-4 bg-cream-dark/30">
          <p className="font-serif text-sm text-ink">
            No close matches found for <span className="font-medium">@{submittedUsername}</span>.
          </p>
          <p className="font-terminal text-xs text-ink-muted mt-1">
            {data.seedBookmarks === 0
              ? "This account hasn't saved any bookmarks yet."
              : 'Save a few more bookmarks on Curius and try again.'}
          </p>
        </div>
      )}

      {data && data.results.length > 0 && (
        <>
          <p className="font-terminal text-xs text-ink-muted mb-4 uppercase tracking-wider">
            {data.results.length} curator{data.results.length === 1 ? '' : 's'} with overlapping taste
            {' · '}seeded from {data.seedBookmarks} of @{data.user.username}&apos;s saves
          </p>
          <div>
            {data.results.map((curator) => {
              const display = fullName(curator);
              const initial = display.charAt(0).toUpperCase();
              return (
                <div
                  key={curator.id}
                  className="group flex items-center gap-3 py-4 border-b border-border/50 last:border-b-0 hover:bg-cream-dark/40 transition-colors"
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-9 h-9 rounded-full font-medium text-sm shrink-0',
                      getAvatarColor(curator.username)
                    )}
                  >
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`https://curius.app/${curator.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-serif text-[15px] font-medium text-ink hover:text-ink-light transition-colors"
                    >
                      {display}
                    </Link>
                    <span className="font-terminal text-xs text-ink-muted ml-2">
                      @{curator.username}
                    </span>
                    <p className="font-terminal text-xs text-ink-muted mt-0.5">
                      {curator.bookmark_count.toLocaleString()} saves total
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-terminal text-sm text-ink font-medium">
                      {curator.shared_bookmarks} shared
                    </p>
                    <p className="font-terminal text-[10px] text-ink-muted uppercase tracking-wider">
                      affinity {Math.round(curator.affinity * 1000) / 10}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
