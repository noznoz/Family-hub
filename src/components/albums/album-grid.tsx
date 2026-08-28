'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Images, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { createAlbum } from '@/lib/actions/albums';
import type { AlbumSummary } from '@/lib/album-queries';

export function AlbumGrid({ albums, live }: { albums: AlbumSummary[]; live: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">Photo albums</h1>
        <NewAlbumDialog live={live} />
      </div>

      {albums.length === 0 ? (
        <EmptyState icon={<Images className="size-6" />} title="No albums yet" hint="Create an album and start adding family photos." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {albums.map((a) => (
            <Link key={a.id} href={`/albums/${a.id}`} className="group">
              <Card className="overflow-hidden transition-shadow hover:shadow-card-hover">
                <div className="relative aspect-square bg-muted">
                  {a.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.coverUrl} alt={a.title} className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-navy-200"><Images className="size-8" /></span>
                  )}
                  <span className="absolute bottom-1 right-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {a.count}
                  </span>
                </div>
                <div className="p-3">
                  <p className="truncate font-bold text-navy">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.count} photo{a.count === 1 ? '' : 's'}{a.updatedAt ? ` · ${a.updatedAt}` : ''}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewAlbumDialog({ live }: { live: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (fd: FormData) => {
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return setError('Give the album a name.');
    setError(null);
    start(async () => {
      const res = live ? await createAlbum({ title, description: String(fd.get('description') ?? '') }) : { ok: true as const, id: undefined };
      if (!res.ok) return setError(res.error);
      setOpen(false);
      if (res.id) router.push(`/albums/${res.id}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="brand" size="sm"><Plus className="size-4" /> New album</Button></DialogTrigger>
      <DialogContent title="New album">
        <form action={onSubmit} className="space-y-3">
          <Field label="Name" htmlFor="title"><Input id="title" name="title" required placeholder="e.g. Summer 2026" /></Field>
          <Field label="Description" htmlFor="description"><Input id="description" name="description" placeholder="Optional" /></Field>
          {!live && <p className="rounded-lg bg-brand-muted px-3 py-2 text-xs text-navy">Demo mode — not saved.</p>}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
