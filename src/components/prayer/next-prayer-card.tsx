'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';
import { MoonStar, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';

const SURREY = new Coordinates(51.2431, -0.5891);
const TZ = 'Europe/London';
const NAMES: Record<string, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

function loadPrefs(): { method: keyof typeof CalculationMethod; madhab: 'shafi' | 'hanafi' } {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('fh_prayer_prefs');
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.method === 'string' && p.method in CalculationMethod) {
          return { method: p.method, madhab: p.madhab === 'hanafi' ? 'hanafi' : 'shafi' };
        }
      }
    } catch { /* ignore */ }
  }
  return { method: 'MuslimWorldLeague', madhab: 'shafi' };
}

function fmt(d: Date) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ }).format(d);
}

/** Compact "next prayer" widget for the Home page (times for University of Surrey). */
export function NextPrayerCard() {
  const [now, setNow] = useState(() => Date.now());
  const [prefs] = useState(loadPrefs);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const next = useMemo(() => {
    const params = CalculationMethod[prefs.method]();
    params.madhab = prefs.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
    const today = new PrayerTimes(SURREY, new Date(), params);
    const tomorrow = new PrayerTimes(SURREY, new Date(Date.now() + 86_400_000), params);
    const seq: { key: string; at: Date }[] = [
      { key: 'fajr', at: today.fajr }, { key: 'dhuhr', at: today.dhuhr }, { key: 'asr', at: today.asr },
      { key: 'maghrib', at: today.maghrib }, { key: 'isha', at: today.isha }, { key: 'fajr', at: tomorrow.fajr },
    ];
    return seq.find((s) => s.at.getTime() > now) ?? seq[seq.length - 1]!;
  }, [now, prefs]);

  const remaining = Math.max(0, next.at.getTime() - now);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const countdown = h > 0 ? `${h}h ${m}m` : `${m}m`;

  return (
    <Link href="/prayer">
      <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-card-hover">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-brand">
          <MoonStar className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next prayer</p>
          <p className="font-bold text-navy">{NAMES[next.key] ?? next.key} · {fmt(next.at)}</p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block font-mono text-sm font-bold tabular-nums text-navy">in {countdown}</span>
          <span className="block text-[11px] text-muted-foreground">Surrey</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-navy-200" />
      </Card>
    </Link>
  );
}
