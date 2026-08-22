import Link from 'next/link';
import { GraduationCap, CalendarClock, Plane, Wallet, CircleDot, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Avatar } from '@/components/ui/avatar';
import { formatMoney } from '@/lib/utils';
import type { StudentSummary } from '@/lib/types';

export function StudentCard({ student }: { student: StudentSummary }) {
  const fundingTone = student.fundingKind === 'government_scholarship' ? 'success' : 'brand';
  return (
    <Link href={`/students/${student.id}`} className="group block" aria-label={`Open ${student.name}'s profile`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-card-hover">
        <div className="flex items-center gap-3 bg-navy px-5 py-4 text-white">
          <Avatar name={student.name} src={student.avatarUrl} size="lg" className="ring-2 ring-white/30" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{student.name}</p>
            <p className="flex items-center gap-1 text-sm text-white/80">
              <GraduationCap className="size-4" /> {student.university}
            </p>
          </div>
          <Chip tone="navy" className="bg-white/15">{student.academicYear.split(' · ')[0]}</Chip>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={fundingTone}>{student.funding}</Chip>
            <Chip tone="success"><CircleDot className="size-3" /> {student.overallStatus}</Chip>
          </div>

          <dl className="divide-y divide-border rounded-xl border border-border">
            <Row icon={<CalendarClock className="size-4 text-attention" />} label="Next task"
                 value={student.nextTask ? student.nextTask.title : 'Nothing due'}
                 meta={student.nextTask?.due} />
            <Row icon={<Wallet className="size-4 text-brand" />} label="Next payment"
                 value={student.nextPayment ? student.nextPayment.label : 'None upcoming'}
                 meta={student.nextPayment ? formatMoney(student.nextPayment.amount, student.nextPayment.currency) : undefined} />
            <Row icon={<Plane className="size-4 text-navy-500" />} label="Next trip"
                 value={student.nextTrip ? student.nextTrip.label : 'No trips planned'}
                 meta={student.nextTrip?.date} />
          </dl>

          <span className="flex items-center justify-center gap-1 rounded-xl bg-muted py-2.5 text-center text-sm font-semibold text-navy transition-colors group-hover:bg-accent">
            View {student.name}&apos;s profile <ChevronRight className="size-4" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

function Row({ icon, label, value, meta }: { icon: React.ReactNode; label: string; value: string; meta?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-navy">{value}</p>
      </div>
      {meta && <span className="shrink-0 text-xs font-semibold text-muted-foreground">{meta}</span>}
    </div>
  );
}
