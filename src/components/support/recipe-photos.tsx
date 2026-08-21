'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { uploadMedia } from '@/lib/storage';
import { setRecipeCover, addRecipePhoto, deleteRecipePhoto } from '@/lib/actions/support';

const MAX_MB = 8;

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_');
}

/** Small button to set / change the recipe's cover photo. */
export function RecipeCoverButton({
  recipeId, familyId, hasCover, live,
}: {
  recipeId: string; familyId: string; hasCover: boolean; live: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Image too large (max ${MAX_MB}MB).`);
    setError(null);
    setBusy(true);
    try {
      if (live) {
        const path = await uploadMedia(familyId, file, `recipes/${recipeId}/cover-${Date.now()}-${safeName(file.name)}`);
        if (!path) { setError('Upload failed. Try again.'); return; }
        const res = await setRecipeCover(recipeId, path);
        if (!res.ok) { setError(res.error); return; }
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {hasCover ? 'Change cover' : 'Add cover'}
      </Button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </>
  );
}

/** Grid of recipe photos with add + delete. */
export function RecipePhotos({
  recipeId, familyId, photos, canEdit, live,
}: {
  recipeId: string;
  familyId: string;
  photos: { id: string; url: string | null; caption: string | null }[];
  canEdit: boolean;
  live: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = photos.filter((p) => p.url);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_MB * 1024 * 1024) { setError(`Some images were too large (max ${MAX_MB}MB) and skipped.`); continue; }
        if (!live) continue;
        const path = await uploadMedia(familyId, file, `recipes/${recipeId}/photo-${Date.now()}-${safeName(file.name)}`);
        if (!path) { setError('An upload failed. Check your connection and try again.'); continue; }
        const res = await addRecipePhoto(recipeId, path);
        if (!res.ok) { setError(res.error); }
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (shown.length === 0 && !canEdit) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Photos</p>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Add photos
          </Button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {error && <p className="mb-2 px-1 text-xs font-medium text-danger">{error}</p>}

      {shown.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/50 py-8 text-muted-foreground hover:border-brand hover:text-brand"
        >
          <ImagePlus className="size-7" />
          <span className="text-sm font-semibold">Add photos of this dish</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {shown.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url!} alt={p.caption ?? 'Recipe photo'} className="size-full object-cover" />
              {canEdit && (
                <DeleteButton
                  itemLabel="this photo"
                  title="Delete photo"
                  onConfirm={() => (live ? deleteRecipePhoto(p.id, recipeId) : Promise.resolve())}
                  onDeleted={() => router.refresh()}
                  className="absolute right-1 top-1 bg-white/85 text-danger shadow-sm backdrop-blur hover:bg-white"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
