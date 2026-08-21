'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { LOCALES, LOCALE_COOKIE, dirFor, resolveLocale, type Locale } from '@/lib/locale';
import { cn } from '@/lib/utils';

function readLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(/(?:^|; )fh_locale=([^;]+)/);
  return resolveLocale(m?.[1]);
}

export function LanguagePicker() {
  const [active, setActive] = useState<Locale>(readLocale);

  const choose = (id: Locale) => {
    setActive(id);
    document.cookie = `${LOCALE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.setAttribute('lang', id);
    document.documentElement.setAttribute('dir', dirFor(id));
    // Reload so server-rendered, translated chrome updates.
    window.location.reload();
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {LOCALES.map((l) => {
        const selected = l.id === active;
        return (
          <button key={l.id} type="button" onClick={() => choose(l.id)} aria-pressed={selected}
            className={cn('flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition',
              selected ? 'border-brand bg-brand-muted' : 'border-border hover:border-navy-200')}>
            <span className="text-lg font-bold text-navy" dir={l.dir}>{l.label}</span>
            {selected && <span className="grid size-5 place-items-center rounded-full bg-brand text-white"><Check className="size-3.5" strokeWidth={3} /></span>}
          </button>
        );
      })}
    </div>
  );
}
