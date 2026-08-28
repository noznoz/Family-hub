'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ImagePlus, Loader2, Pencil, Star, Images, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteButton } from '@/components/ui/delete-button';
import { ShareButton } from '@/components/ui/share-button';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { uploadMedia } from '@/lib/storage';
import {
  addAlbumPhoto, deleteAlbumPhoto, setPhotoCaption, setAlbumCover, updateAlbum, deleteAlbum,
} from '@/lib/actions/albums';
import type { AlbumDetail, AlbumPhoto } from '@/lib/album-queries';

const MAX_MB = 15;

export function AlbumDetailView({
  album, familyId, live,
}: {
  album: AlbumDetail;
  familyId: string;
  live: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPhoto, setOpenPhoto] = useState<AlbumPhoto | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    if (!live) { setError('Demo mode — photos are not saved.'); return; }
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > MAX_MB * 1024 * 1024) { setError(`Skipped ${file.name} — over ${MAX_MB}MB.`); continue; }
        const safe = file.name.replace(/[^\w.\-]+/g, '_');
        const path = await uploadMedia(familyId, file, `albums/${album.id}/${Date.now()}-${safe}`);
        if (path) await addAlbumPhoto({ albumId: album.id, storagePath: path });
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const shareText = `📸 ${album.title} — ${album.photos.length} photo${album.photos.length === 1 ? '' : 's'} in our Family Hub album`;

  return (
    <div className="space-y-4">
      <Link href="/albums" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
        <ChevronLeft className="size-4" /> Albums
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-navy">{album.title}</h1>
          {album.description && <p className="text-sm text-muted-foreground">{album.description}</p>}
          <p className="text-xs text-muted-foreground">{album.photos.length} photo{album.photos.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <ShareButton text={shareText} url={`/albums/${album.id}`} />
          <EditAlbumDialog album={album} live={live} />
          <DeleteButton
            itemLabel={`“${album.title}” and all its photos`} title="Delete album"
            onConfirm={() => (live ? deleteAlbum(album.id) : Promise.resolve())}
            onDeleted={() => router.push('/albums')}
          />
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <Button variant="brand" onClick={() => inputRef.current?.click()} disabled={busy} className="w-full">
        {busy ? <><Loader2 className="size-4 animate-spin" /> Uploading…</> : <><ImagePlus className="size-4" /> Add photos</>}
      </Button>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      {album.photos.length === 0 ? (
        <EmptyState icon={<Images className="size-6" />} title="No photos yet" hint="Tap “Add photos” to upload the first ones." />
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {album.photos.map((p) => (
            <button
              key={p.id} type="button" onClick={() => setOpenPhoto(p)}
              className="relative aspect-square overflow-hidden rounded-xl bg-muted"
            >
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.caption ?? 'Photo'} className="size-full object-cover" loading="lazy" />
              )}
              {p.isCover && <span className="absolute left-1 top-1 rounded-full bg-black/55 p-1 text-white"><Star className="size-3 fill-white" /></span>}
            </button>
          ))}
        </div>
      )}

      {openPhoto && (
        <Lightbox
          photo={openPhoto} albumId={album.id} live={live}
          onClose={() => setOpenPhoto(null)}
          onChanged={() => { setOpenPhoto(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function EditAlbumDialog({ album, live }: { album: AlbumDetail; live: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const onSubmit = (fd: FormData) => {
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return setError('Give the album a name.');
    setError(null);
    start(async () => {
      const res = live ? await updateAlbum({ id: album.id, title, description: String(fd.get('description') ?? '') }) : { ok: true as const };
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh();
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Edit album" className="inline-flex size-8 items-center justify-center rounded-lg text-navy-400 hover:bg-muted hover:text-navy"><Pencil className="size-4" /></button>
      </DialogTrigger>
      <DialogContent title="Edit album">
        <form action={onSubmit} className="space-y-3">
          <Field label="Name" htmlFor="title"><Input id="title" name="title" required defaultValue={album.title} /></Field>
          <Field label="Description" htmlFor="description"><Input id="description" name="description" defaultValue={album.description ?? ''} placeholder="Optional" /></Field>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="flex gap-2 pt-1">
            <DialogClose asChild><Button type="button" variant="outline" className="flex-1">Cancel</Button></DialogClose>
            <Button type="submit" variant="brand" className="flex-1" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Lightbox({
  photo, albumId, live, onClose, onChanged,
}: {
  photo: AlbumPhoto;
  albumId: string;
  live: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();
  const [caption, setCaption] = useState(photo.caption ?? '');

  const saveCaption = () => start(async () => {
    if (live && caption !== (photo.caption ?? '')) await setPhotoCaption(photo.id, albumId, caption);
    onChanged();
  });
  const makeCover = () => start(async () => { if (live) await setAlbumCover(photo.id, albumId); onChanged(); });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 safe-top safe-bottom" role="dialog" aria-modal="true">
      <div className="flex justify-end">
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="size-5" /></button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {photo.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={photo.caption ?? 'Photo'} className="max-h-full max-w-full rounded-lg object-contain" />
        )}
      </div>
      <div className="mx-auto w-full max-w-md space-y-2 pt-3">
        <Input
          value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption…" className="border-white/20 bg-white/10 text-white placeholder:text-white/50"
        />
        <div className="flex gap-2">
          <Button variant="brand" className="flex-1" onClick={saveCaption} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : 'Save caption'}
          </Button>
          {!photo.isCover && (
            <Button variant="outline" className="flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={makeCover} disabled={pending}>
              <Star className="size-4" /> Set cover
            </Button>
          )}
          <DeleteButton
            itemLabel="this photo" title="Delete photo" className="bg-white/10 text-white hover:bg-white/20"
            onConfirm={() => (live ? deleteAlbumPhoto(photo.id, albumId) : Promise.resolve())}
            onDeleted={onChanged}
          />
        </div>
      </div>
    </div>
  );
}
