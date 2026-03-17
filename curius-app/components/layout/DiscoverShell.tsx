'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Compass, Globe, Layers, Search, Users } from 'lucide-react';

const tabs = [
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
    name: 'Sources',
    href: '/discover/sources',
    icon: Globe,
  },
  {
    name: 'People',
    href: '/discover/people',
    icon: Users,
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
      <nav className="border-b border-border/60">
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
                    'group relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-ink'
                      : 'text-ink-muted hover:text-ink-light'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>

                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-ink rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container px-4 md:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
