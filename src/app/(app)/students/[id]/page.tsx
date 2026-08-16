import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GraduationCap, MapPin } from 'lucide-react';
import { demoStudents } from '@/lib/demo-data';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Avatar } from '@/components/ui/avatar';

export const metadata: Metadata = { title: 'Student' };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = demoStudents.find((s) => s.id === id);
  if (!student) notFound();

  const journey = ['Preparation', 'Arrival', 'Year 1', 'Year 2', 'Final Year', 'Graduation'];
  const currentStage = 2; // Year 1

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
          {journey.map((stage, i) => (
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
              {i < journey.length - 1 && <span className="text-navy-200">→</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
