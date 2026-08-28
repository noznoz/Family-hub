'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { generateVapidKeys, type PushStatus } from '@/lib/actions/push-config';

export function PushSetup({ status }: { status: PushStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (status.tableMissing) {
    return <p className="rounded-lg bg-attention-soft px-3 py-2 text-xs text-navy">Setting up the config store — check back in a minute.</p>;
  }

  const setup = () => {
    setMsg(null);
    start(async () => {
      const res = await generateVapidKeys(false);
      setMsg(res.ok ? 'Push is ready — everyone can now enable notifications below.' : res.error);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="mb-3 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-navy"><BellRing className="size-4" /> Push service</p>
        {status.configured
          ? <Chip tone="success"><Check className="size-3" /> Ready</Chip>
          : <Chip tone="neutral">Not set up</Chip>}
      </div>
      {status.configured ? (
        <p className="mt-1 text-xs text-muted-foreground">The push service is set up for the whole family. Each person turns it on for their own device below.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">One-time setup so phones can receive push notifications. After this, each person taps “Enable notifications”.</p>
          <Button variant="brand" size="sm" className="mt-2" onClick={setup} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : 'Set up push service'}
          </Button>
        </>
      )}
      {msg && <p className="mt-2 text-xs font-medium text-navy">{msg}</p>}
    </div>
  );
}
