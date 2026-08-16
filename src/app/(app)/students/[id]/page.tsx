import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GraduationCap, MapPin } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getStudents } from '@/lib/queries';
import { getStudentDetail } from '@/lib/queries-student';
import { demoStudents } from '@/lib/demo-data';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Avatar } from '@/components/ui/avatar';

export const metadata: Metadata = { title: 'Student' };

const JOURNEY = ['Preparation', 'Arrival', 'Year 1', 'Year 2', 'Final Year', 'Graduation'];

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) return null;

  const students = session.isDemo ? demoStudents : await getStudents(session.familyId);
  const student = students.find((s) => s.id === id);
  if (!student) notFound();

  const detail = session.isDemo ? null : await getStudentDetail(id);
  const currentStage = student.overallStatus === 'Graduated' ? 5 : 2;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 bg-navy p-5 text-white">
          <Avatar name={student.name} size="lg" className="ring-2 ring-white/30" />
          <div>
            <p className="text-xl font-bold">{student.name}</p>
            <p className="flex items-center gap-1 text-sm text-white/80">
              <GraduationCap className="size-4" /> {student.university}
            </p>
            <p className="flex items-center gap-1 text-sm text-white/80">
              <MapPin className="size-4" /> {student.academicYear}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 p-5">
          <Chip tone={student.fundingKind === 'government_scholarship' ? 'success' : 'brand'}>{student.funding}</Chip>
          <Chip tone="success">{student.overallStatus}</Chip>
        </div>
      </Card>

      <section>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Journey</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {JOURNEY.map((stage, i) => (
            <div key={stage} className="flex items-center gap-1">
              <div
                className={
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ' +
                  (i < currentStage ? 'bg-success-soft text-success'
                    : i === currentStage ? 'bg-navy text-white'
                    : 'bg-muted text-muted-foreground')
                }
              >
                {stage}
              </div>
              {i < JOURNEY.length - 1 && <span className="text-navy-200">→</span>}
            </div>
          ))}
        </div>
      </section>

      {detail && detail.funding.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Funding history</p>
          <Card className="divide-y divide-border">
            {detail.funding.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-navy">{f.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.start_date}{f.end_date ? ` → ${f.end_date}` : ' → present'}
                  </p>
                </div>
                <Chip tone={f.status === 'active' ? 'success' : 'neutral'}>{f.status}</Chip>
              </div>
            ))}
          </Card>
        </section>
      )}

      {detail && detail.milestones.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Milestones</p>
          <Card className="divide-y divide-border">
            {detail.milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4">
                <p className="font-medium text-navy">{m.title}</p>
                {m.occurred_on && <span className="text-xs text-muted-foreground">{m.occurred_on}</span>}
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
