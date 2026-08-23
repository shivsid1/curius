import { redirect } from 'next/navigation';

// The Twin feature grew into the Readers hub -- pseudonymous reader
// identities with persistent catalogue numbers.
export default function TwinPage() {
  redirect('/discover/readers');
}
