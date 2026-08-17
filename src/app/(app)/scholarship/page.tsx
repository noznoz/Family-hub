import type { Metadata } from 'next';
import { Award, Check, Circle } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { getScholarshipInfo } from '@/lib/journey-queries';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Scholarship' };

const STAGES = ['family_funded', 'eligibility', 'application', 'under_review', 'approved', 'active'];
const stageLabel = (s: string) => s.replace(/_/g, ' ');

export default async function ScholarshipPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const students = session.isDemo ? [] : await getScholarshipInfo(session.familyId);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Scholarship</h1>
      {students.length === 0 ? (
        <EmptyState icon={<Award className="size-6" />} title="No scholarship info yet" hint="Scholarship status and requirements appear here." />
      ) : (
        students.map((s) => {
          const stageIdx = STAGES.indexOf(s.stage);
          return (
            <Card key={s.studentId} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-navy">{s.name}</p>
                <Chip tone={s.stage === 'active' ? 'success' : 'brand'} className="capitalize">{stageLabel(s.stage)}</Chip>
              </div>
              <p className="text-sm text-muted-foreground">Sponsor: {s.sponsor}</p>

              <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
                {STAGES.map((stg, i) => (
                  <div key={stg} className="flex items-center gap-1">
                    <span className={'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ' + (i < stageIdx ? 'bg-success-soft text-success' : i === stageIdx ? 'bg-navy text-white' : 'bg-muted text-muted-foreground')}>
                      {stageLabel(stg)}
                    </span>
                    {i < STAGES.length - 1 && <span className="text-navy-200">→</span>}
                  </div>
                ))}
              </div>

              {s.requirements.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Requirements</p>
                  <div className="space-y-1.5">
                    {s.requirements.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {r.done ? <Check className="size-4 text-success" /> : <Circle className="size-4 text-navy-200" />}
                        <span className="flex-1 text-navy">{r.title}</span>
                        <span className="text-xs text-muted-foreground">{r.due}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {s.funding.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">Funding history</p>
                  <div className="space-y-1">
                    {s.funding.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-navy">{f.label}</span>
                        <span className="text-xs text-muted-foreground">{f.start} → {f.end}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
