import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { getCalendar } from '@/lib/journey-queries';
import { getStudentOptions } from '@/lib/document-queries';
import { CalendarView } from '@/components/calendar/calendar-view';

export const metadata: Metadata = { title: 'Calendar' };

export default async function CalendarPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const canManage = session.member.role === 'admin' || session.member.role === 'parent';
  const [events, students] = session.isDemo
    ? [[], []]
    : await Promise.all([getCalendar(session.familyId), getStudentOptions(session.familyId)]);

  return <CalendarView events={events} students={students} live={!session.isDemo} canManage={canManage} meId={session.memberId} />;
}
