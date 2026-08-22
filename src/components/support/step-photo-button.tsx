'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, X } from 'lucide-react';
import { uploadMedia } from '@/lib/storage';
import { setRecipeStepImage } from '@/lib/actions/support';

/** Attach / replace / remove the photo on one recipe step. */
export function StepPhotoButton({
  stepId, recipeId, familyId, hasImage, live,
}: {
  stepId: string; recipeId: string; familyId: string; hasImage: boolean; live: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file || !live) return;
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = await uploadMedia(familyId, file, `recipes/${recipeId}/step-${stepId}-${Date.now()}-${safe}`);
      if (path) await setRecipeStepImage(stepId, recipeId, path);
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try { if (live) await setRecipeStepImage(stepId, recipeId, null); router.refresh(); }
    finally { setBusy(false); }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />} {hasImage ? 'Replace photo' : 'Add photo'}
      </button>
      {hasImage && (
        <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
          <X className="size-3.5" /> Remove
        </button>
      )}
    </span>
  );
}
