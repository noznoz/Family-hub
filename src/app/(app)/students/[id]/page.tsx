import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  GraduationCap, MapPin, Mail, Phone, Wallet, HandCoins, FileText, ListChecks,
  Landmark, Fingerprint, HeartPulse, Home, Plane, Flag, ExternalLink, IdCard, CalendarClock, Users,
} from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getStudents } from '@/lib/queries';
import { getStudentDetail, getStudentPrivate, canSeeStudentPrivate } from '@/lib/queries-student';
import { demoStudents } from '@/lib/demo-data';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Avatar } from '@/components/ui/avatar';
import { ShareButton } from '@/components/ui/share-button';
import { SecretValue } from '@/components/students/secret-value';
import { StudentPrivateDialog } from '@/components/students/student-private-dialog';
import { AcademicEditDialog } from '@/components/students/academic-edit-dialog';
import { JourneyStagePicker } from '@/components/students/journey-stage-picker';
import { MovePrep } from '@/components/students/move-prep';
import { EmergencyCard } from '@/components/students/emergency-card';
import { MilestonesManager } from '@/components/students/milestones-manager';

export const metadata: Metadata = { title: 'Student' };

const JOURNEY = ['Preparation', 'Arrival', 'Year 1', 'Year 2', 'Final Year', 'Graduation'];
const priorityTone: Record<string, 'neutral' | 'attention' | 'danger'> = { normal: 'neutral', important: 'attention', urgent: 'danger' };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) return null;

  const students = session.isDemo ? demoStudents : await getStudents(session.familyId);
  const student = students.find((s) => s.id === id);
  if (!student) notFound();

  const [detail, canPrivate] = session.isDemo
    ? [null, false]
    : await Promise.all([getStudentDetail(id), canSeeStudentPrivate(id)]);
  const priv = canPrivate ? await getStudentPrivate(id) : null;

  const canEditAcademics = !session.isDemo && (
    session.member.role === 'admin' || session.member.role === 'parent' || session.memberId === detail?.memberId
  );
  // Current journey stage: use the saved value; otherwise default to
  // "Preparation" (still at home), or the last stage once graduated.
  const savedStageIndex = detail?.journeyStage ? JOURNEY.indexOf(detail.journeyStage) : -1;
  const currentStage = savedStageIndex >= 0
    ? savedStageIndex
    : (student.overallStatus === 'Graduated' ? JOURNEY.length - 1 : 0);
  const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: detail?.currency ?? 'GBP', maximumFractionDigits: 0 });

  const shareText = [
    `🎓 ${student.name}`,
    `${detail?.university ?? student.university}${detail?.course ? ` · ${detail.course}` : ''}`,
    student.academicYear,
    detail?.studentRef ? `Student ID: ${detail.studentRef}` : '',
    detail?.accommodation ? `🏠 ${detail.accommodation.property}` : '',
  ].filter(Boolean).join('\n');

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="bg-navy p-5 text-white">
          <div className="flex items-start gap-4">
            <Avatar name={student.name} src={student.avatarUrl} size="lg" className="ring-2 ring-white/30" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold">{student.name}</p>
              <p className="flex items-center gap-1 text-sm text-white/80">
                <GraduationCap className="size-4" /> {detail?.university ?? student.university}
                {detail?.universityCity ? `, ${detail.universityCity}` : ''}
              </p>
              {detail?.course && <p className="text-sm text-white/80">{detail.course}</p>}
              <p className="mt-1 flex items-center gap-1 text-sm text-white/70"><MapPin className="size-4" /> {student.academicYear}</p>
            </div>
            {canPrivate && <StudentPrivateDialog studentId={id} name={student.name} data={priv} live={!session.isDemo} />}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip tone={student.fundingKind === 'government_scholarship' ? 'success' : 'brand'}>{student.funding}</Chip>
            <Chip tone="success">{student.overallStatus}</Chip>
          </div>
          {/* Quick actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {detail?.phone && <ActionLink href={`tel:${detail.phone}`} icon={<Phone className="size-4" />} label="Call" />}
            {detail?.email && <ActionLink href={`mailto:${detail.email}`} icon={<Mail className="size-4" />} label="Email" />}
            <span className="[&_button]:!bg-white/10 [&_button]:!text-white [&_button:hover]:!bg-white/20 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-2">
              <ShareButton text={shareText} url={`/students/${id}`} label="Share" />
            </span>
          </div>
        </div>

        {/* Stat tiles */}
        {detail && (
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            <Stat icon={<Wallet className="size-4" />} label="Spent" value={money.format(detail.spentTotal)} />
            <Stat icon={<HandCoins className="size-4" />} label="Open requests" value={String(detail.openRequests)} />
            <Stat icon={<ListChecks className="size-4" />} label="Open tasks" value={String(detail.tasks.length)} />
            <Stat icon={<FileText className="size-4" />} label="Documents" value={String(detail.documentsCount)} />
          </div>
        )}
      </Card>

      {/* ── Journey ──────────────────────────────────────────── */}
      <Section title="Journey">
        <JourneyStagePicker
          studentId={id}
          stages={JOURNEY}
          currentIndex={currentStage}
          canEdit={canEditAcademics}
          live={!session.isDemo}
        />
      </Section>

      {/* ── Move to the UK (checklist + countdown) ───────────── */}
      {detail && (
        <MovePrep
          studentId={id}
          name={student.name}
          items={detail.checklist}
          nextDepartureISO={detail.nextDepartureISO}
          termStartISO={detail.startDateISO}
          live={!session.isDemo}
          canManage={canEditAcademics}
        />
      )}

      {/* ── Contact ──────────────────────────────────────────── */}
      <Section title="Contact & personal">
        <Card className="divide-y divide-border">
          <Row icon={<Mail className="size-5" />} label="Email" value={detail?.email ?? '—'} />
          <Row icon={<Phone className="size-5" />} label="Phone" value={detail?.phone ?? priv?.phone ?? 'Not set'} />
          <Row icon={<Home className="size-5" />} label="Address"
            value={priv?.address ?? detail?.accommodation?.address ?? 'Not set'} />
          {priv?.emergencyContact && <Row icon={<Flag className="size-5" />} label="Emergency" value={priv.emergencyContact} />}
          {priv?.bloodType && <Row icon={<HeartPulse className="size-5" />} label="Blood type" value={priv.bloodType} />}
          {priv?.doctorGp && <Row icon={<HeartPulse className="size-5" />} label="GP" value={priv.doctorGp} />}
        </Card>
      </Section>

      {/* ── University ───────────────────────────────────────── */}
      {detail && (
        <Section
          title="University"
          action={canEditAcademics && (
            <AcademicEditDialog
              studentId={id}
              name={student.name}
              live={!session.isDemo}
              values={{
                universityName: detail.university === '—' ? '' : detail.university,
                universityCity: detail.universityCity ?? '',
                universityWebsite: detail.universityWebsite ?? '',
                course: detail.course ?? '',
                studentRef: detail.studentRef ?? '',
                campus: detail.campus ?? '',
                advisor: detail.advisor ?? '',
                startDate: detail.startDateISO ?? '',
                expectedGraduation: detail.expectedGraduationISO ?? '',
              }}
            />
          )}
        >
          <Card className="divide-y divide-border">
            <Row icon={<GraduationCap className="size-5" />} label="Course" value={detail.course ?? '—'} />
            <Row icon={<IdCard className="size-5" />} label="Student ID" value={detail.studentRef ?? '—'} />
            {detail.campus && <Row icon={<MapPin className="size-5" />} label="Campus" value={detail.campus} />}
            {detail.advisor && <Row icon={<Users className="size-5" />} label="Advisor" value={detail.advisor} />}
            {detail.startDate && <Row icon={<CalendarClock className="size-5" />} label="Started" value={detail.startDate} />}
            {detail.expectedGraduation && <Row icon={<CalendarClock className="size-5" />} label="Graduates" value={detail.expectedGraduation} />}
            {detail.universityWebsite && (
              <a href={detail.universityWebsite} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 hover:bg-muted">
                <span className="text-navy-400"><ExternalLink className="size-5" /></span>
                <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Website</span>
                <span className="flex-1 truncate text-sm font-medium text-brand">{detail.universityWebsite}</span>
              </a>
            )}
          </Card>
          {detail.years.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.years.map((y) => (
                <Chip key={y.label} tone={y.status === 'active' ? 'success' : y.status === 'completed' ? 'neutral' : 'brand'}>
                  Year {y.studyYear ?? '?'} · {y.label}
                </Chip>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Emergency card (sensitive) ───────────────────────── */}
      {canPrivate && (priv?.emergencyContact || priv?.bloodType || priv?.doctorGp || detail?.phone || priv?.phone) && (
        <Section title="Emergency" hint="Quick access — share or copy">
          <EmergencyCard info={{
            name: student.name,
            university: detail?.university === '—' ? null : (detail?.university ?? null),
            course: detail?.course ?? null,
            phone: detail?.phone ?? priv?.phone ?? null,
            address: priv?.address ?? detail?.accommodation?.address ?? null,
            emergencyContact: priv?.emergencyContact ?? null,
            bloodType: priv?.bloodType ?? null,
            gp: priv?.doctorGp ?? null,
            passportNumber: priv?.passportNumber ?? null,
          }} />
        </Section>
      )}

      {/* ── Banking (sensitive) ──────────────────────────────── */}
      {canPrivate && (priv?.bankName || priv?.accountNumber || priv?.iban) && (
        <Section title="Banking" hint="Only you & parents/admins can see this">
          <Card className="divide-y divide-border">
            {priv?.bankName && <Row icon={<Landmark className="size-5" />} label="Bank" value={priv.bankName} />}
            {priv?.accountNumber && <SecretRow icon={<Landmark className="size-5" />} label="Account" value={priv.accountNumber} />}
            {priv?.sortCode && <SecretRow icon={<Landmark className="size-5" />} label="Sort code" value={priv.sortCode} />}
            {priv?.iban && <SecretRow icon={<Landmark className="size-5" />} label="IBAN" value={priv.iban} />}
          </Card>
        </Section>
      )}

      {/* ── Identity (sensitive) ─────────────────────────────── */}
      {canPrivate && (priv?.nationalInsurance || priv?.brpNumber || priv?.passportNumber) && (
        <Section title="Identity" hint="Only you & parents/admins can see this">
          <Card className="divide-y divide-border">
            {priv?.nationalInsurance && <SecretRow icon={<Fingerprint className="size-5" />} label="NI number" value={priv.nationalInsurance} />}
            {priv?.brpNumber && <SecretRow icon={<Fingerprint className="size-5" />} label="BRP" value={priv.brpNumber} />}
            {priv?.passportNumber && <SecretRow icon={<Fingerprint className="size-5" />} label="Passport" value={priv.passportNumber} />}
          </Card>
        </Section>
      )}

      {/* ── Accommodation ────────────────────────────────────── */}
      {detail?.accommodation && (
        <Section title="Accommodation">
          <Card className="p-4">
            <p className="font-bold text-navy">{detail.accommodation.property}</p>
            {detail.accommodation.address && <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" /> {detail.accommodation.address}</p>}
            <Chip tone="brand" className="mt-2">{detail.accommodation.rent}</Chip>
          </Card>
        </Section>
      )}

      {/* ── Tasks ────────────────────────────────────────────── */}
      {detail && detail.tasks.length > 0 && (
        <Section title="Tasks" action={<Link href="/tasks" className="text-xs font-semibold text-brand">All tasks</Link>}>
          <Card className="divide-y divide-border">
            {detail.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-navy"><ListChecks className="size-4" /></span>
                <span className="min-w-0 flex-1 truncate font-medium text-navy">{t.title}</span>
                {t.priority !== 'normal' && <Chip tone={priorityTone[t.priority] ?? 'neutral'}>{t.priority}</Chip>}
                {t.due && <span className="shrink-0 text-xs font-semibold text-muted-foreground">{t.due}</span>}
              </div>
            ))}
          </Card>
        </Section>
      )}

      {/* ── Upcoming trips ───────────────────────────────────── */}
      {detail && detail.upcomingTrips.length > 0 && (
        <Section title="Upcoming trips">
          <Card className="divide-y divide-border">
            {detail.upcomingTrips.map((t, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-navy"><Plane className="size-4" /></span>
                <span className="flex-1 font-medium text-navy">{t.title}</span>
                <span className="text-xs font-semibold text-muted-foreground">{t.when}</span>
              </div>
            ))}
          </Card>
        </Section>
      )}

      {/* ── Funding history ──────────────────────────────────── */}
      {detail && detail.funding.length > 0 && (
        <Section title="Funding history">
          <Card className="divide-y divide-border">
            {detail.funding.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-navy">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.start_date}{f.end_date ? ` → ${f.end_date}` : ' → present'}</p>
                </div>
                <Chip tone={f.status === 'active' ? 'success' : 'neutral'}>{f.status}</Chip>
              </div>
            ))}
          </Card>
        </Section>
      )}

      {/* ── Milestones ───────────────────────────────────────── */}
      {detail && (
        <MilestonesManager
          studentId={id}
          milestones={detail.milestones}
          live={!session.isDemo}
          canManage={session.member.role === 'admin' || session.member.role === 'parent'}
        />
      )}

      {canPrivate && priv?.notes && (
        <Section title="Notes"><Card className="p-4 text-sm text-navy">{priv.notes}</Card></Section>
      )}
    </div>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}{hint && <span className="ml-2 font-normal normal-case text-navy-300">· {hint}</span>}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-navy-400">{icon}</span>
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words text-sm font-medium text-navy">{value}</span>
    </div>
  );
}

function SecretRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-navy-400">{icon}</span>
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1"><SecretValue value={value} /></span>
    </div>
  );
}

function ActionLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20">
      {icon} {label}
    </a>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icon} {label}</p>
      <p className="mt-1 text-lg font-extrabold text-navy">{value}</p>
    </div>
  );
}
