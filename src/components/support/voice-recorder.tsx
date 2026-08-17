'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, Trash2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadMedia } from '@/lib/storage';
import { saveRecipeVoiceNote } from '@/lib/actions/support';

type State = 'idle' | 'recording' | 'preview' | 'saving' | 'denied';

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
}

export function VoiceRecorder({ recipeId, familyId }: { recipeId: string; familyId: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const start = async () => {
    setError(null);
    const mime = pickMime();
    if (!mime) { setError('Recording is not supported on this browser.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const b = new Blob(chunksRef.current, { type: mime });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setState('preview');
      };
      recorderRef.current = rec;
      rec.start();
      setSeconds(0);
      setState('recording');
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setState('denied');
    }
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null); setPreviewUrl(null); setSeconds(0); setState('idle');
  };

  const save = async () => {
    if (!blob) return;
    setState('saving');
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const path = await uploadMedia(familyId, blob, `recipes/${recipeId}/voice-${Date.now()}.${ext}`, blob.type);
    if (!path) { setError('Upload failed. Check your connection and try again.'); setState('preview'); return; }
    const res = await saveRecipeVoiceNote(recipeId, path, seconds);
    if (!res.ok) { setError(res.error); setState('preview'); return; }
    discard();
    router.refresh();
  };

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  if (state === 'denied') {
    return (
      <div className="rounded-xl bg-attention-soft p-3 text-sm text-attention">
        Microphone access was blocked. Enable it in your browser settings to record a voice note.
        <button onClick={() => setState('idle')} className="ml-2 font-semibold underline">Try again</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      {state === 'idle' && (
        <Button variant="brand" size="sm" onClick={start} className="w-full">
          <Mic className="size-4" /> Record a voice note
        </Button>
      )}
      {state === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="flex size-3 shrink-0 animate-pulse rounded-full bg-danger" />
          <span className="flex-1 font-semibold text-navy">Recording… {mmss}</span>
          <Button variant="danger" size="sm" onClick={stop}><Square className="size-4" /> Stop</Button>
        </div>
      )}
      {(state === 'preview' || state === 'saving') && (
        <div className="space-y-2">
          {previewUrl && <audio controls src={previewUrl} className="w-full" />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={discard} disabled={state === 'saving'}>
              <Trash2 className="size-4" /> Discard
            </Button>
            <Button variant="success" size="sm" className="flex-1" onClick={save} disabled={state === 'saving'}>
              {state === 'saving' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
