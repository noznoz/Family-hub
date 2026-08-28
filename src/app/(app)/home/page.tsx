import type { Metadata } from 'next';
import Link from 'next/link';
import { ListChecks, Wallet, Plane, FileText, LifeBuoy, HandCoins } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getStudents, getAttention, getHomeSummary, type HomeSummary } from '@/lib/queries';
import { demoStudents, demoAttention } from '@/lib/demo-data';
import { StudentCard } from '@/components/home/student-card';
import { AttentionList } from '@/components/home/attention-list';
import { NextPrayerCard } from '@/components/prayer/next-prayer-card';
import { SectionTitle } from '@/components/ui/section-title';
import { Card } from '@/components/ui/card';
import type { StudentSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Home' };

export default async function HomePage() {
  const session = await getSessionUser();
  if (!session) return null;
  const { member } = session;

  const [students, attention, summary] = session.isDemo
    ? [demoStudents, demoAttention, null]
    : await Promise.all([getStudents(session.familyId), getAttention(session.familyId), getHomeSummary(session.familyId)]);

  // Student-specific dashboard
  if (member.role === 'student') {
    const me = students.find((s) => s.name === member.displayName) ?? students[0];
    if (!me) return <StudentEmpty name={member.displayName} />;
    return <StudentHome name={member.displayName} student={me} />;
  }

  const greeting = getGreeting();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{greeting}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Hi {member.displayName} 👋</h1>
      </div>

      <NextPrayerCard />

      {summary && <DashboardStrip summary={summary} />}

      {students.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No students yet. Add a student in the Family section to get started.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {students.map((s) => (
            <StudentCard key={s.id} student={s} />
          ))}
        </div>
      )}

      <section className="space-y-3">
        <SectionTitle>Needs attention</SectionTitle>
        <AttentionList items={attention} />
      </section>
    </div>
  );
}

function StudentEmpty({ name }: { name: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Good day, {name} 👋</h1>
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Your student profile isn&apos;t set up yet. Ask a parent to add it.
      </Card>
    </div>
  );
}

function StudentHome({ name, student }: { name: string; student: StudentSummary }) {
  const shortcuts = [
    { href: '/tasks', label: 'My Tasks', icon: ListChecks, tone: 'bg-attention-soft text-attention' },
    { href: '/money', label: 'My Money', icon: Wallet, tone: 'bg-brand-muted text-brand' },
    { href: '/travel', label: 'My Next Trip', icon: Plane, tone: 'bg-success-soft text-success' },
    { href: '/documents', label: 'My Documents', icon: FileText, tone: 'bg-muted text-navy' },
  ];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{getGreeting()}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Good day, {name} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">{student.university} · {student.academicYear}</p>
      </div>

      <NextPrayerCard />

      <div className="grid grid-cols-2 gap-3">
        {shortcuts.map(({ href, label, icon: Icon, tone }) => (
          <Link key={href} href={href}>
            <Card className="flex h-28 flex-col justify-between p-4 transition-shadow hover:shadow-card-hover">
              <span className={`inline-flex size-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="size-5" />
              </span>
              <span className="font-bold text-navy">{label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <SectionTitle>Upcoming</SectionTitle>
        <Card className="divide-y divide-border">
          {student.nextTask && <RowLine href="/tasks" label={student.nextTask.title} meta={student.nextTask.due} />}
          {student.nextTrip && <RowLine href="/travel" label={student.nextTrip.label} meta={student.nextTrip.date} />}
          {!student.nextTask && !student.nextTrip && (
            <div className="p-4 text-sm text-muted-foreground">Nothing upcoming right now.</div>
          )}
        </Card>
      </section>

      <Link href="/support" className="flex items-center gap-3 rounded-2xl bg-navy px-5 py-4 text-white">
        <LifeBuoy className="size-6" />
        <div>
          <p className="font-bold">Need help with something?</p>
          <p className="text-sm text-white/80">Recipes, laundry &amp; home basics</p>
        </div>
      </Link>
    </div>
  );
}

function RowLine({ label, meta, href }: { label: string; meta: string; href?: string }) {
  const inner = (
    <>
      <p className="text-sm font-medium text-navy">{label}</p>
      <span className="text-xs font-semibold text-muted-foreground">{meta}</span>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center justify-between p-4 transition-colors hover:bg-muted">{inner}</Link>
  ) : (
    <div className="flex items-center justify-between p-4">{inner}</div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function DashboardStrip({ summary }: { summary: HomeSummary }) {
  const days = summary.nextTrip ? Math.max(0, Math.ceil((new Date(summary.nextTrip.iso).getTime() - Date.now()) / 86_400_000)) : null;
  const tiles = [
    days !== null
      ? { href: '/travel', icon: Plane, label: 'Next flight', value: `${days}d`, tone: 'bg-navy text-white' }
      : { href: '/travel', icon: Plane, label: 'Trips', value: '—', tone: 'bg-muted text-navy' },
    { href: '/tasks', icon: ListChecks, label: 'Open tasks', value: String(summary.openTasks), tone: 'bg-attention-soft text-attention' },
    { href: '/documents', icon: FileText, label: 'Docs expiring', value: String(summary.docsExpiring), tone: 'bg-brand-muted text-brand' },
    { href: '/money', icon: HandCoins, label: 'Requests', value: String(summary.openRequests), tone: 'bg-success-soft text-success' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <Link key={t.label} href={t.href}>
          <Card className="flex h-full flex-col gap-1.5 p-3 transition-shadow hover:shadow-card-hover">
            <span className={`inline-flex size-8 items-center justify-center rounded-lg ${t.tone}`}><t.icon className="size-4" /></span>
            <span className="text-xl font-extrabold text-navy">{t.value}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
