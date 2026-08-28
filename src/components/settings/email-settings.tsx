'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Check, Loader2, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Chip } from '@/components/ui/chip';
import { saveEmailConfig, sendTestEmail, type EmailStatus } from '@/lib/actions/email-config';

export function EmailSettings({ status }: { status: EmailStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onSave = (fd: FormData) => {
    const apiKey = String(fd.get('apiKey') ?? '');
    const from = String(fd.get('from') ?? '');
    setMsg(null);
    start(async () => {
      const res = await saveEmailConfig({ apiKey, from });
      setMsg(res.ok ? { ok: true, text: 'Saved. Email notifications are on.' } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  };

  const onTest = () => {
    setMsg(null);
    start(async () => {
      const res = await sendTestEmail();
      setMsg(res.ok ? { ok: true, text: 'Test sent — check your inbox.' } : { ok: false, text: res.error });
    });
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold text-navy"><Mail className="size-4" /> Email delivery</p>
        {status.configured
          ? <Chip tone="success"><Check className="size-3" /> On</Chip>
          : <Chip tone="neutral">Off</Chip>}
      </div>

      {status.tableMissing ? (
        <p className="rounded-lg bg-attention-soft px-3 py-2 text-xs text-navy">
          Setting up… the config store is being created. Please check back in a minute, then reload this page.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Send task & reminder emails via Resend. Paste your API key from{' '}
            <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">resend.com/api-keys</a>.
            {status.configured && ' A key is already saved — enter a new one only to replace it.'}
          </p>
          <form action={onSave} className="space-y-3">
            <Field label="Resend API key" htmlFor="apiKey">
              <Input id="apiKey" name="apiKey" type="password" autoComplete="off" placeholder={status.configured ? '•••••••• (saved)' : 're_…'} />
            </Field>
            <Field label="Sender (optional)" htmlFor="from">
              <Input id="from" name="from" defaultValue={status.from ?? ''} placeholder="Family Hub <hub@yourdomain.com>" />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="brand" className="flex-1" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
              </Button>
              <Button type="button" variant="outline" onClick={onTest} disabled={pending || !status.configured}>
                <Send className="size-4" /> Send test
              </Button>
            </div>
          </form>
          <p className="text-[11px] text-muted-foreground">
            New Resend accounts can only email your own address until you verify a domain in Resend. Your key is stored server-side and never shown again.
          </p>
        </>
      )}

      {msg && <p className={`text-sm font-medium ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
    </Card>
  );
}
