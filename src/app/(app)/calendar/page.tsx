import type { Metadata } from 'next';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return (
    <PhasePlaceholder
      title="Calendar"
      phase="Phase 9"
      intro="One unified family calendar for flights, payments, deadlines and reminders."
      features={["Flights, rent, tuition and university deadlines","Visa reminders and document expiry","Month and Upcoming views","Filter by Hamza, Omar or Family"]}
    />
  );
}
