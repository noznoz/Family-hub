'use client';

import { useState, useTransition } from 'react';
import { Megaphone, Loader2, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { sendFamilyBroadcast } from '@/lib/actions/broadcast';

const QUICK = ['Dinner is ready 🍽️', 'Call me please 📞', 'Family meeting in 10 min', 'On my way 🚗'];

export function NotifyFamily({ live }: { live: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [body, setBody] = useState('');

  const submit = (fd: FormData) => {
    const message = String(fd.get('body') ?? body).trim();
    const title = String(fd.get('title') ?? '');
    if (!message) return setError('Type a message.');
    setError(null);
    start(async () => {
      const res = live ? await sendFamilyBroadcast({ title, body: message }) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setBody(''); }, 1100);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); setSent(false); } }}>
      <DialogTrigger asChild>
        <Card className="flex cursor-pointer items-center gap-3 p-4 transition-shadow hover:shadow-card-hover">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-muted text-brand"><Megaphone className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-navy">Notify the family</p>
            <p className="text-xs text-muted-foreground">Send a quick push to everyone&apos;s phone</p>
          </div>
        </Card>
      </DialogTrigger>
      <DialogContent title="Notify the family">
        {sent ? (
          <div className="flex flex-col items-center gap-2 py-6 text-success">
            <Check className="size-8" /> <p className="font-semibold">Sent!</p>
          </div>
        ) : (
          <form action={submit} className="space-y-3">
            <Field label="Title (optional)" htmlFor="title">
              <Input id="title" name="title" placeholder="Defaults to your name" />
            </Field>
            <Field label="Message" htmlFor="body">
              <Input id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} required placeholder="e.g. Dinner is ready" />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => setBody(q)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-navy hover:bg-muted">{q}</button>
              ))}
            </div>
            {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not sent.</p>}
            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            <div className="flex gap-2 pt-1">
              <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
              <Button type="submit" variant="brand" className="flex-1" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : 'Send'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
