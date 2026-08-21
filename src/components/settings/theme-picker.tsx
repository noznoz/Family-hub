'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { THEMES, THEME_COOKIE, DEFAULT_THEME, type ThemeId } from '@/lib/theme';
import { cn } from '@/lib/utils';

function readThemeCookie(): ThemeId {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const m = document.cookie.match(/(?:^|; )fh_theme=([^;]+)/);
  const v = m?.[1];
  return (THEMES.find((t) => t.id === v)?.id as ThemeId) ?? DEFAULT_THEME;
}

/**
 * Per-member look-and-feel chooser. Writes the choice to a cookie and updates
 * <html data-theme> immediately so the whole app re-skins with no reload. The
 * cookie is read server-side on the next load so the choice sticks (and there's
 * no flash of the wrong theme).
 */
export function ThemePicker() {
  const [active, setActive] = useState<ThemeId>(readThemeCookie);

  function choose(id: ThemeId) {
    setActive(id);
    document.documentElement.setAttribute('data-theme', id);
    document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {THEMES.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            aria-pressed={selected}
            className={cn(
              'group relative overflow-hidden rounded-2xl border-2 p-0 text-left transition',
              selected ? 'border-brand' : 'border-border hover:border-navy-200',
            )}
          >
            {/* Mini preview rendered in the theme's own colors */}
            <div className="p-3" style={{ background: t.swatch.bg }}>
              <div
                className="flex items-center gap-2 px-1 pb-2"
                style={{ borderRadius: t.radius }}
              >
                <span
                  className="grid size-6 place-items-center text-[10px] font-extrabold text-white"
                  style={{ background: t.swatch.accent, borderRadius: t.radius }}
                >
                  FH
                </span>
                <span className="text-xs font-bold" style={{ color: t.swatch.ink }}>
                  Family Hub
                </span>
              </div>
              <div
                className="mb-1.5 h-8 w-full"
                style={{ background: t.swatch.ink, borderRadius: t.radius }}
              />
              <div className="flex gap-1.5">
                <span
                  className="h-4 flex-1"
                  style={{ background: t.swatch.soft, borderRadius: t.radius }}
                />
                <span
                  className="h-4 w-8"
                  style={{ background: t.swatch.accent, borderRadius: t.radius }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-navy">{t.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{t.tagline}</p>
              </div>
              {selected && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
