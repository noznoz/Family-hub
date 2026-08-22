'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { CURRENCIES, CURRENCY_COOKIE, resolveCurrency, type Currency } from '@/lib/currency';
import { cn } from '@/lib/utils';

function readCurrency(): Currency {
  if (typeof document === 'undefined') return 'GBP';
  const m = document.cookie.match(/(?:^|; )fh_currency=([^;]+)/);
  return resolveCurrency(m?.[1]);
}

export function CurrencyPicker() {
  const [active, setActive] = useState<Currency>(readCurrency);
  const choose = (c: Currency) => {
    setActive(c);
    document.cookie = `${CURRENCY_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <div className="flex flex-wrap gap-2">
      {CURRENCIES.map((c) => (
        <button key={c} type="button" onClick={() => choose(c)} aria-pressed={c === active}
          className={cn('inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition',
            c === active ? 'border-brand bg-brand-muted text-navy' : 'border-border text-muted-foreground hover:border-navy-200')}>
          {c === active && <Check className="size-3.5 text-brand" />} {c}
        </button>
      ))}
    </div>
  );
}
