import type { Metadata } from 'next';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export const metadata: Metadata = { title: 'Documents' };

export default function Page() {
  return (
    <PhasePlaceholder
      title="Documents"
      phase="Phase 5"
      intro="A secure, private vault for passports, visas, scholarship letters and more."
      features={["Private categories and per-document visibility","Expiry dates and reminders","Version history (never overwrite last year)","Private storage with signed access"]}
    />
  );
}
