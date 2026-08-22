'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { setJourneyStage } from '@/lib/actions/journey';

/**
 * The student's journey tracker. When `canEdit`, tapping a stage sets it as
 * the current stage. Otherwise it's a read-only progress strip.
 */
export function JourneyStagePicker({
  studentId, stages, currentIndex, canEdit, live,
}: {
  studentId: string;
  stages: string[];
  currentIndex: number;
  canEdit: boolean;
  live: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [current, setCurrent] = useState(currentIndex);
  const [error, setError] = useState<string | null>(null);

  const choose = (i: number, stage: string) => {
    if (!canEdit || i === current) return;
    setError(null);
    setCurrent(i);
    setBusyIdx(i);
    start(async () => {
      if (live) {
        const res = await setJourneyStage(studentId, stage);
        if (!res.ok) { setError(res.error); setCurrent(currentIndex); }
      }
      setBusyIdx(null);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map((stage, i) => {
          const cls = i < current
            ? 'bg-success-soft text-success'
            : i === current
              ? 'bg-navy text-white'
              : 'bg-muted text-muted-foreground';
          const content = (
            <span className="inline-flex items-center gap-1">
              {busyIdx === i && <Loader2 className="size-3 animate-spin" />}
              {stage}
            </span>
          );
          return (
            <div key={stage} className="flex items-center gap-1">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => choose(i, stage)}
                  disabled={pending}
                  aria-current={i === current ? 'step' : undefined}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-90 disabled:opacity-60 ${cls}`}
                >
                  {content}
                </button>
              ) : (
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${cls}`}>{content}</span>
              )}
              {i < stages.length - 1 && <span className="text-navy-200">→</span>}
            </div>
          );
        })}
      </div>
      {canEdit && <p className="mt-1.5 px-1 text-xs text-muted-foreground">Tap a stage to update where they are now.</p>}
      {error && <p className="mt-1 px-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
