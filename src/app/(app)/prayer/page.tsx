import type { Metadata } from 'next';
import { PrayerTimesView } from '@/components/prayer/prayer-times-view';

export const metadata: Metadata = { title: 'Prayer Times' };

export default function PrayerPage() {
  return <PrayerTimesView />;
}
