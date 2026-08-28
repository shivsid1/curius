'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Compass, Layers, Map, Search, Users, Zap } from 'lucide-react';
import { Ornament } from '@/components/shared/Ornament';
import { CreatorLetter } from '@/components/layout/CreatorLetter';
import { EmailSignup } from '@/components/layout/DigestCallout';

const tabs = [
  { name: 'Explore', href: '/discover/explore', icon: Compass },
  { name: 'Trending', href: '/discover/convergence', icon: Layers },
  { name: 'Readers', href: '/discover/readers', icon: Users },
  { name: 'Atlas', href: '/discover/atlas', icon: Map },
  { name: 'Search', href: '/discover/search', icon: Search },
];

interface DiscoverShellProps {
  children: React.ReactNode;
}

export function DiscoverShell({ children }: DiscoverShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* Tab Navigation */}
      <nav>
        <div className="container mx-auto px-4 md:px-6">
          {/* Icon-only below sm so all six items fit a phone; overflow-x-auto
              as a safety net for very narrow viewports. */}
          <div className="flex items-center gap-0 overflow-x-auto">
            {tabs.map((tab) => {
              // Reader catalogue pages live under /reader/[n] but belong to
              // the Readers tab conceptually.
              const isActive =
                pathname.startsWith(tab.href) ||
                (tab.href === '/discover/readers' && pathname.startsWith('/reader'));
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={cn(
                    'group relative flex items-center gap-2 px-4 py-3 text-sm transition-colors',
                    isActive
                      ? 'text-ink font-medium'
                      : 'text-ink-muted hover:text-ink-light'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="font-cartographic hidden sm:inline">{tab.name}</span>

                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-ink rounded-full" />
                  )}
                </Link>
              );
            })}

            {/* The cannon: fire me somewhere good. A toy, so it gets an icon,
                not a tab. */}
            <Link
              href="/discover/launch"
              title="Launch me somewhere"
              aria-label="Launch me somewhere"
              className={cn(
                'ml-auto flex items-center gap-2 px-4 py-3 text-sm transition-colors',
                pathname.startsWith('/discover/launch')
                  ? 'text-ink font-medium'
                  : 'text-ink-muted hover:text-ink-light'
              )}
            >
              <Zap className="h-4 w-4 shrink-0" />
              <span className="font-cartographic hidden md:inline">Launch</span>
            </Link>
          </div>
        </div>
        <Ornament variant="divider" className="px-4 md:px-6" />
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 md:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-10">
        <div className="container px-4 md:px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Brand */}
            <div>
              <Link href="/discover" className="flex items-center gap-2 mb-2">
                <Image src="/illustrations/compass.png" alt="" width={28} height={28} />
                <span className="font-atlas text-base text-ink">Curius Atlas</span>
              </Link>
              <p className="font-terminal text-xs text-ink-muted">
                Cataloguing what curious people read.
              </p>
            </div>

            {/* Email digest -- the one thing that matters */}
            <div className="md:col-span-2">
              <h3 className="font-serif text-base text-ink mb-1">
                The five most converged links each week.
              </h3>
              <p className="font-scholarly text-sm text-ink-muted mb-3">
                One email, every Sunday. The bookmarks the most readers independently saved.
              </p>
              <EmailSignup />
              <div className="mt-4 flex items-center gap-4 font-terminal text-xs text-ink-muted">
                <a href="https://curius.app" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">Curius</a>
                <span className="text-cream-border">·</span>
                <CreatorLetter />
              </div>
            </div>
          </div>
        </div>

        {/* Austin skyline -- edge to edge */}
        <div className="w-full overflow-hidden max-h-[260px]">
          <Image
            src="/illustrations/austin.png"
            alt=""
            width={1920}
            height={1920}
            className="w-full object-cover object-center opacity-95"
            priority={false}
          />
        </div>
      </footer>
    </div>
  );
}
