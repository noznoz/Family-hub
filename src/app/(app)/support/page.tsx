import type { Metadata } from 'next';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export const metadata: Metadata = { title: 'Support' };

export default function Page() {
  return (
    <PhasePlaceholder
      title="Support"
      phase="Phase 8"
      intro="Recipes, laundry and home basics — the things Hamza and Omar would normally call home to ask."
      features={["Food recipes with images and voice notes","Laundry guides incl. your apartment washing machine","Home basics: dishwasher, oven, cleaning, Wi-Fi reset","Emergency & useful family info"]}
    />
  );
}
