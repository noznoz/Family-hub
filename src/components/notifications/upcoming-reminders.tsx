'use client';

import { useState, useTransition } from 'react';
import { BellRing, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cancelReminder } from '@/lib/actions/reminders';
import type { UpcomingReminder } from '@/lib/journey-queries';

export function UpcomingReminders({ reminders, live }: { reminders: UpcomingReminder[]; live: boolean }) {
  const [list, setList] = useState(reminders);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (list.length === 0) return null;

  const cancel = (id: string) => {
    setPendingId(id);
    startTransition(async () => {
      if (live) await cancelReminder(id);
      setList((l) => l.filter((r) => r.id !== id));
      setPendingId(null);
    });
  };

  return (
    <div>
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Upcoming reminders</p>
      <Card className="divide-y divide-border">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-attention-soft text-attention"><BellRing className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-navy">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {r.when}
                {r.recipients.length > 0 && ` · ${r.recipients.join(', ')}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => cancel(r.id)}
              disabled={pendingId === r.id}
              aria-label="Cancel reminder"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-navy-400 transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}
