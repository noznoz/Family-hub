'use client';

import { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

/** Shows a sensitive value masked, with reveal + copy-to-clipboard. */
export function SecretValue({ value, mono = true }: { value: string; mono?: boolean }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <span className={mono ? 'font-mono tabular-nums text-navy' : 'text-navy'}>
        {shown ? value : '•'.repeat(Math.min(value.length, 10))}
      </span>
      <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide' : 'Reveal'} className="text-navy-400 hover:text-navy">
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button type="button" onClick={copy} aria-label="Copy" className="text-navy-400 hover:text-navy">
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </button>
    </span>
  );
}
