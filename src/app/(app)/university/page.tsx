import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getUniversityInfo } from '@/lib/journey-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'University' };

const yearTone = (s: string) => (s === 'active' ? 'success' : s === 'completed' ? 'neutral' : 'brand');

export default async function UniversityPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const students = session.isDemo ? [] : await getUniversityInfo(session.familyId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">University</h1>
      {students.length === 0 ? (
        <EmptyState icon={<GraduationCap className="size-6" />} title="No university info yet" hint="Course and academic years appear here." />
      ) : (
        students.map((s) => (
          <Card key={s.studentId} className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={s.name} size="lg" />
              <div>
                <p className="font-bold text-navy">{s.name}</p>
                <p className="text-sm text-muted-foreground">{s.university}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-xs font-semibold uppercase text-muted-foreground">Course</p><p className="text-navy">{s.course}</p></div>
              <div><p className="text-xs font-semibold uppercase text-muted-foreground">Student ID</p><p className="text-navy">{s.ref}</p></div>
            </div>
            {s.years.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Academic years</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.years.map((y) => (
                    <Chip key={y.label} tone={yearTone(y.status)}>Year {y.studyYear ?? '?'} · {y.label}</Chip>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
