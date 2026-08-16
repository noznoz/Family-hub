import type { Metadata } from 'next';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export const metadata: Metadata = { title: 'University' };

export default function Page() {
  return (
    <PhasePlaceholder
      title="University"
      phase="Phase 7"
      intro="Course, campus, academic years and terms across the whole journey."
      features={["University, course and student ID","Academic years and flexible terms","Important deadlines and contacts","Visual journey: Preparation → Graduation"]}
    />
  );
}
