'use client';

import { useState, useCallback, useRef } from 'react';

export default function LaunchPage() {
  const [isFiring, setIsFiring] = useState(false);
  const [destination, setDestination] = useState<{ title: string; domain: string; link: string } | null>(null);
  const cannonRef = useRef<HTMLImageElement>(null);

  const handleFire = useCallback(async () => {
    if (isFiring) return;

    // Reserve the popup synchronously inside the user-gesture click handler
    // so browsers don't block it after async work completes.
    const popup = window.open('', '_blank');

    setIsFiring(true);
    setDestination(null);

    // Trigger cannon animation
    if (cannonRef.current) {
      cannonRef.current.src = `/illustrations/cannon-fire.png?t=${Date.now()}`;
    }

    try {
      const res = await fetch('/api/bookmarks/random?minSaves=5');
      const data = await res.json();

      if (data.data) {
        // Show destination briefly before launching
        setTimeout(() => {
          setDestination({
            title: data.data.title || 'Untitled',
            domain: data.data.domain || '',
            link: data.data.link,
          });

          // Launch after showing destination
          setTimeout(() => {
            if (popup && !popup.closed) {
              popup.location.href = data.data.link;
            } else {
              window.open(data.data.link, '_blank');
            }
            // Reset
            setTimeout(() => {
              setIsFiring(false);
              setDestination(null);
              if (cannonRef.current) {
                cannonRef.current.src = '/illustrations/cannon-still.png';
              }
            }, 1000);
          }, 1500);
        }, 1200);
      } else if (popup && !popup.closed) {
        popup.close();
      }
    } catch (err) {
      console.error('Failed to fetch random bookmark:', err);
      if (popup && !popup.closed) popup.close();
      setIsFiring(false);
    }
  }, [isFiring]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] w-full px-4 -mt-4">
      {/* Cannon */}
      <div className="flex justify-center w-full">
        <button
          onClick={handleFire}
          disabled={isFiring}
          className="group relative cursor-pointer disabled:cursor-wait"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={cannonRef}
            src="/illustrations/cannon-still.png"
            alt="Cannon"
            className="w-48 h-48 md:w-64 md:h-64 translate-x-2 transition-transform group-hover:scale-105 group-active:scale-95"
          />
        </button>
      </div>

      {/* Copy */}
      {!destination ? (
        <div className="text-center mt-6 max-w-md">
          <h1 className="font-atlas text-2xl md:text-3xl text-ink mb-3">
            Launch me somewhere
          </h1>
          <p className="font-serif text-sm text-ink-muted leading-relaxed">
            Get fired into a random corner of the internet.
            Sourced from {(180000).toLocaleString()}+ bookmarks saved by curious people.
          </p>
          {!isFiring && (
            <button
              onClick={handleFire}
              className="mt-6 px-10 py-3 bg-ink text-cream font-terminal text-base rounded-lg hover:bg-ink-light transition-colors"
            >
              Fire
            </button>
          )}
          {isFiring && (
            <p className="mt-6 font-terminal text-sm text-ink-muted animate-pulse">
              Finding your destination...
            </p>
          )}
        </div>
      ) : (
        <div className="text-center mt-6 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          <p className="font-terminal text-xs text-ink-muted mb-2">Launching you to</p>
          <h2 className="font-serif text-lg text-ink font-medium mb-1 line-clamp-2">
            {destination.title}
          </h2>
          <p className="font-terminal text-xs text-ink-muted">{destination.domain}</p>
        </div>
      )}
    </div>
  );
}
