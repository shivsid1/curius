import { Header } from '@/components/layout/Header';
import { DiscoverShell } from '@/components/layout/DiscoverShell';

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <DiscoverShell>{children}</DiscoverShell>
    </>
  );
}
