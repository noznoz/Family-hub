import type { Metadata } from 'next';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export const metadata: Metadata = { title: 'Scholarship' };

export default function Page() {
  return (
    <PhasePlaceholder
      title="Scholarship"
      phase="Phase 7"
      intro="Hamza's active scholarship and Omar's journey toward one — with full history preserved."
      features={["Hamza: status, sponsor, requirements, deadlines","Omar: Family Funded → Eligibility → Application → Active","Required documents and reports","History never overwrites old funding periods"]}
    />
  );
}
