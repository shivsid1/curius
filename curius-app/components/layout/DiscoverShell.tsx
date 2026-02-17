'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Compass, Layers, Search } from 'lucide-react';

const tabs = [
  {
    name: 'Explore',
    href: '/discover/explore',
    icon: Compass,
    description: 'Browse by topic',
  },
  {
    name: 'Convergence',
    href: '/discover/convergence',
    icon: Layers,
    description: 'Popular across curators',
  },
  {
    name: 'Search',
    href: '/discover/search',
    icon: Search,
    description: 'Find specific links',
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
      <nav className="border-b border-border bg-cream-dark/50">
        <div className="container px-4">
          <div className="flex items-center gap-1">
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
                      ? 'text-ink'
                      : 'text-ink-muted hover:text-ink-light'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-handwritten text-lg">{tab.name}</span>

                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container px-4 py-6">
        {children}
      </main>
    </div>
  );
}
