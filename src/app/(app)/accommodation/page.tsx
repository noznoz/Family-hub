import type { Metadata } from 'next';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export const metadata: Metadata = { title: 'Accommodation' };

export default function Page() {
  return (
    <PhasePlaceholder
      title="Accommodation"
      phase="Phase 6"
      intro="Where Hamza and Omar live now — and everywhere they have lived before."
      features={["Property, landlord and contract details","Rent, deposit and payment dates","Wi-Fi, utilities and maintenance notes","Move-in photos and full history"]}
    />
  );
}
