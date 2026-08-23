import { redirect } from 'next/navigation';

// Roots merged into the Atlas: the map shows the territory, the roots list
// names the landmarks. One place for both.
export default function SourcesPage() {
  redirect('/discover/atlas');
}
