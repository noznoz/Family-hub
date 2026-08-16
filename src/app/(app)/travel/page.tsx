import type { Metadata } from 'next';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export const metadata: Metadata = { title: 'Travel' };

export default function Page() {
  return (
    <PhasePlaceholder
      title="Travel"
      phase="Phase 6"
      intro="Flights and trips for the whole family, with full history kept for every academic year."
      features={["Trips with multiple travelers","Flights: airline, booking ref, terminal, seat, baggage","Airport transfer and destination address","Upcoming / Past / by Academic Year"]}
    />
  );
}
