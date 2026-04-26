'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Compass, Globe, Layers, Map, Search, Users, Zap } from 'lucide-react';
import { Ornament } from '@/components/shared/Ornament';
import { CreatorLetter } from '@/components/layout/CreatorLetter';

const tabs = [
  {
    name: 'Launch',
    href: '/discover/launch',
    icon: Zap,
  },
  {
    name: 'Explore',
    href: '/discover/explore',
    icon: Compass,
  },
  {
    name: 'Trending',
    href: '/discover/convergence',
    icon: Layers,
  },
  {
    name: 'Roots',
    href: '/discover/sources',
    icon: Globe,
  },
  {
    name: 'People',
    href: '/discover/people',
    icon: Users,
  },
  {
    name: 'Atlas',
    href: '/discover/atlas',
    icon: Map,
  },
  {
    name: 'Search',
    href: '/discover/search',
    icon: Search,
  },
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
        <div className="container px-4 md:px-6">
          <div className="flex items-center gap-0">
            {tabs.map((tab) => {
              const isActive = pathname.startsWith(tab.href);
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
                  <Icon className="h-4 w-4" />
                  <span className="font-cartographic">{tab.name}</span>

                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-ink rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <Ornament variant="divider" className="px-4 md:px-6" />
      </nav>

      {/* Main Content */}
      <main className="container px-4 md:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-10">
        <div className="container px-4 md:px-6 pb-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link href="/discover" className="flex items-center gap-2 mb-3">
                <Image src="/illustrations/compass.png" alt="" width={28} height={28} />
                <span className="font-atlas text-base text-ink">Curius Atlas</span>
              </Link>
              <p className="font-terminal text-xs text-ink-muted">
                Cataloguing what curious people read.
              </p>
            </div>

            {/* Navigation */}
            <div>
              <h3 className="font-terminal text-xs text-ink-muted uppercase tracking-wider mb-3">Navigate</h3>
              <div className="space-y-2">
                <Link href="/discover/explore" className="block font-serif text-sm text-ink-light hover:text-ink transition-colors">Explore</Link>
                <Link href="/discover/convergence" className="block font-serif text-sm text-ink-light hover:text-ink transition-colors">Trending</Link>
                <Link href="/discover/sources" className="block font-serif text-sm text-ink-light hover:text-ink transition-colors">Roots</Link>
                <Link href="/discover/people" className="block font-serif text-sm text-ink-light hover:text-ink transition-colors">People</Link>
              </div>
            </div>

            {/* Topics */}
            <div>
              <h3 className="font-terminal text-xs text-ink-muted uppercase tracking-wider mb-3">Topics</h3>
              <div className="space-y-2">
                <span className="block font-serif text-sm text-ink-light">Technology</span>
                <span className="block font-serif text-sm text-ink-light">Culture</span>
                <span className="block font-serif text-sm text-ink-light">Science</span>
                <span className="block font-serif text-sm text-ink-light">Business</span>
              </div>
            </div>

            {/* About */}
            <div>
              <h3 className="font-terminal text-xs text-ink-muted uppercase tracking-wider mb-3">About</h3>
              <div className="space-y-2">
                <a href="https://curius.app" target="_blank" rel="noopener noreferrer" className="block font-serif text-sm text-ink-light hover:text-ink transition-colors">Curius</a>
                <Link href="/discover/search" className="block font-serif text-sm text-ink-light hover:text-ink transition-colors">Search</Link>
                <CreatorLetter />
              </div>
            </div>
          </div>
        </div>

        {/* SF skyline -- edge to edge, cropped to bottom half */}
        <div className="w-full overflow-hidden max-h-[250px]">
          <Image
            src="/illustrations/sf.png"
            alt=""
            width={1920}
            height={1920}
            className="w-full object-cover object-bottom opacity-60 translate-y-[10%]"
            priority={false}
          />
        </div>
      </footer>
    </div>
  );
}
