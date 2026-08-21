'use client';

import { useEffect, useMemo, useState } from 'react';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab, SunnahTimes } from 'adhan';
import { Sunrise, Sun, Sunset, MoonStar, Moon, MapPin, Clock, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/utils';

// University of Surrey, Guildford, England.
const SURREY = new Coordinates(51.2431, -0.5891);
const TZ = 'Europe/London';
const STORE_KEY = 'fh_prayer_prefs';

const METHODS: { id: keyof typeof CalculationMethod; label: string }[] = [
  { id: 'MuslimWorldLeague', label: 'Muslim World League' },
  { id: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
  { id: 'Egyptian', label: 'Egyptian' },
  { id: 'Karachi', label: 'Karachi' },
  { id: 'UmmAlQura', label: 'Umm al-Qura' },
  { id: 'NorthAmerica', label: 'ISNA' },
];

type MethodId = (typeof METHODS)[number]['id'];
type MadhabId = 'shafi' | 'hanafi';

interface Row { key: string; label: string; icon: LucideIcon; info?: boolean }
const ROWS: Row[] = [
  { key: 'fajr', label: 'Fajr', icon: MoonStar },
  { key: 'sunrise', label: 'Sunrise', icon: Sunrise, info: true },
  { key: 'dhuhr', label: 'Dhuhr', icon: Sun },
  { key: 'asr', label: 'Asr', icon: Sun },
  { key: 'maghrib', label: 'Maghrib', icon: Sunset },
  { key: 'isha', label: 'Isha', icon: Moon },
];

function fmt(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ }).format(d);
}

function loadPrefs(): { method: MethodId; madhab: MadhabId } {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (METHODS.some((m) => m.id === p.method)) return { method: p.method, madhab: p.madhab === 'hanafi' ? 'hanafi' : 'shafi' };
      }
    } catch { /* ignore */ }
  }
  return { method: 'MuslimWorldLeague', madhab: 'shafi' };
}

export function PrayerTimesView() {
  const [{ method, madhab }, setPrefs] = useState(loadPrefs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify({ method, madhab })); } catch { /* ignore */ }
  }, [method, madhab]);

  const { rows, nextKey, nextAt, qiyam } = useMemo(() => {
    const params = CalculationMethod[method]();
    params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
    const today = new PrayerTimes(SURREY, new Date(), params);
    const tomorrow = new PrayerTimes(SURREY, new Date(Date.now() + 86_400_000), params);
    const sunnah = new SunnahTimes(today);

    const times: Record<string, Date> = {
      fajr: today.fajr, sunrise: today.sunrise, dhuhr: today.dhuhr,
      asr: today.asr, maghrib: today.maghrib, isha: today.isha,
    };
    const rows = ROWS.map((r) => ({ ...r, at: times[r.key] ?? new Date() }));
    // Next actual prayer (skip sunrise), rolling to tomorrow's Fajr after Isha.
    const seq: { key: string; at: Date }[] = [
      { key: 'fajr', at: today.fajr }, { key: 'dhuhr', at: today.dhuhr },
      { key: 'asr', at: today.asr }, { key: 'maghrib', at: today.maghrib },
      { key: 'isha', at: today.isha }, { key: 'fajr', at: tomorrow.fajr },
    ];
    const fallback = seq[seq.length - 1]!;
    const upcoming = seq.find((s) => s.at.getTime() > now) ?? fallback;
    return { rows, nextKey: upcoming.key, nextAt: upcoming.at, qiyam: sunnah.lastThirdOfTheNight };
  }, [method, madhab, now]);

  const remaining = Math.max(0, nextAt.getTime() - now);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  const countdown = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  const nextLabel = ROWS.find((r) => r.key === nextKey)?.label ?? '';

  const todayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date());

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">Prayer Times</h1>

      {/* Next prayer / countdown */}
      <Card className="overflow-hidden">
        <div className="bg-navy px-5 py-4 text-white">
          <p className="flex items-center gap-1.5 text-sm text-white/80"><MapPin className="size-4" /> University of Surrey · Guildford</p>
          <p className="mt-0.5 text-sm text-white/70">{todayLabel}</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Next prayer</p>
              <p className="text-2xl font-extrabold">{nextLabel}</p>
              <p className="text-sm text-white/80">{fmt(nextAt)}</p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wide text-white/70"><Clock className="size-3.5" /> In</p>
              <p className="font-mono text-2xl font-extrabold tabular-nums">{countdown}</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-border">
          {rows.map((r) => {
            const isNext = r.key === nextKey && !r.info;
            const Icon = r.icon;
            return (
              <div key={r.label} className={cn('flex items-center gap-3 px-5 py-3', isNext && 'bg-brand-muted')}>
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl',
                  r.info ? 'bg-muted text-navy-400' : isNext ? 'bg-brand text-white' : 'bg-muted text-navy')}>
                  <Icon className="size-5" />
                </span>
                <span className={cn('flex-1 font-semibold', r.info ? 'text-muted-foreground' : 'text-navy')}>
                  {r.label}
                  {r.info && <span className="ml-2 text-xs font-normal">(end of Fajr)</span>}
                </span>
                {isNext && <Chip tone="brand">Next</Chip>}
                <span className={cn('font-mono tabular-nums', r.info ? 'text-muted-foreground' : 'font-bold text-navy')}>
                  {fmt(r.at)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Qiyam / last third of the night */}
      <Card className="flex items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-navy"><Moon className="size-5" /></span>
        <span className="flex-1 font-semibold text-navy">Last third of the night <span className="text-xs font-normal text-muted-foreground">(Qiyam)</span></span>
        <span className="font-mono font-bold tabular-nums text-navy">{fmt(qiyam)}</span>
      </Card>

      {/* Calculation settings */}
      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Calculation</p>
        <Card className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-navy">Method</span>
            <select
              value={method}
              onChange={(e) => setPrefs((p) => ({ ...p, method: e.target.value as MethodId }))}
              className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {METHODS.map((mo) => <option key={mo.id} value={mo.id}>{mo.label}</option>)}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-sm font-semibold text-navy">Asr (madhab)</span>
            <div className="flex gap-2">
              {(['shafi', 'hanafi'] as MadhabId[]).map((mad) => (
                <button
                  key={mad}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, madhab: mad }))}
                  className={cn('flex-1 rounded-xl border-2 px-3 py-2 text-sm font-semibold capitalize transition-colors',
                    madhab === mad ? 'border-brand bg-brand-muted text-navy' : 'border-border text-muted-foreground hover:bg-muted')}
                >
                  {mad === 'shafi' ? 'Standard (Shafi)' : 'Hanafi'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Times are calculated for the University of Surrey and shown in UK local time, so they’re correct for Hamza &amp; Omar even when you’re viewing from abroad.
          </p>
        </Card>
      </div>
    </div>
  );
}
