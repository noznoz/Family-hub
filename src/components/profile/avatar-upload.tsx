'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { uploadMedia } from '@/lib/storage';
import { updateMyAvatar } from '@/lib/actions/profile';
import { setMemberAvatar } from '@/lib/actions/family';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function extFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  if (fromName) return fromName.replace(/[^a-z0-9]/g, '') || 'jpg';
  const fromType = file.type.split('/')[1] ?? 'jpg';
  return fromType === 'jpeg' ? 'jpg' : fromType;
}

/**
 * Profile-picture picker. Uploads to the private media bucket, then saves the
 * path. `admin` targets another member (requires manage_family_members); the
 * default targets the signed-in member.
 */
export function AvatarUpload({
  memberId,
  familyId,
  name,
  currentUrl,
  live = true,
  admin = false,
  size = 'lg',
}: {
  memberId: string;
  familyId: string;
  name: string;
  currentUrl?: string | null;
  live?: boolean;
  admin?: boolean;
  size?: 'md' | 'lg';
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (path: string | null) =>
    admin ? setMemberAvatar(memberId, path) : updateMyAvatar(path);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > MAX_BYTES) return setError('Image must be under 5 MB.');

    if (!live) {
      setPreview(URL.createObjectURL(file));
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    start(async () => {
      const path = await uploadMedia(familyId, file, `avatars/${memberId}-${Date.now()}.${extFor(file)}`);
      if (!path) {
        setError('Upload failed. Please try again.');
        setPreview(null);
        return;
      }
      const res = await save(path);
      if (!res.ok) {
        setError(res.error);
        setPreview(null);
        return;
      }
      router.refresh();
    });
  };

  const onRemove = () => {
    setError(null);
    start(async () => {
      if (live) {
        const res = await save(null);
        if (!res.ok) return setError(res.error);
      }
      setPreview(null);
      router.refresh();
    });
  };

  const shown = preview ?? currentUrl ?? null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar name={name} src={shown} size={size} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-label="Change photo"
          className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-white bg-brand text-white shadow-sm hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="text-xs font-semibold text-brand hover:underline disabled:opacity-60"
        >
          {shown ? 'Change photo' : 'Add photo'}
        </button>
        {shown && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="flex items-center gap-1 text-xs font-semibold text-danger hover:underline disabled:opacity-60"
          >
            <Trash2 className="size-3" /> Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      {!live && <p className="text-[11px] text-muted-foreground">Demo mode — not saved.</p>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
