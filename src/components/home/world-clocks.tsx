'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface Zone { label: string; flag: string; tz: string }

const ZONES: [Zone, Zone] = [
  { label: 'Jeddah', flag: '🇸🇦', tz: 'Asia/Riyadh' },
  { label: 'UK', flag: '🇬🇧', tz: 'Europe/London' },
];

/** Hour (0–23) in a given time zone, for the day/night icon. */
function hourIn(tz: string, now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(now));
}

/** Whole-hour offset of a zone from UTC (DST-aware), via the locale-string trick. */
function offsetHours(tz: string, now: Date): number {
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const zoned = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  return Math.round((zoned.getTime() - utc.getTime()) / 3_600_000);
}

export function WorldClocks() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null; // avoid SSR/client hydration mismatch on time

  const diff = offsetHours(ZONES[0].tz, now) - offsetHours(ZONES[1].tz, now);
  const diffLabel = diff === 0 ? 'same time' : `${Math.abs(diff)}h ${diff > 0 ? 'ahead' : 'behind'}`;

  return (
    <div className="flex items-stretch gap-2">
      {ZONES.map((z, i) => {
        const time = new Intl.DateTimeFormat('en-GB', { timeZone: z.tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
        const day = new Intl.DateTimeFormat('en-GB', { timeZone: z.tz, weekday: 'short', day: 'numeric', month: 'short' }).format(now);
        const h = hourIn(z.tz, now);
        const night = h >= 21 || h < 6;
        return (
          <div key={z.label} className="flex flex-1 items-center gap-2.5 rounded-2xl border border-border bg-white/70 px-3 py-2.5">
            <span className="text-lg leading-none" aria-hidden>{z.flag}</span>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {z.label}
                {night ? <Moon className="size-3 text-navy-400" /> : <Sun className="size-3 text-attention" />}
              </p>
              <p className="text-lg font-extrabold leading-tight text-navy">{time}</p>
              <p className="text-[11px] text-muted-foreground">{day}{i === 0 ? ` · ${diffLabel}` : ''}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
