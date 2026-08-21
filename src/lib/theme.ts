/**
 * Look-and-feel themes. Each member picks one; the choice is stored in a cookie
 * and applied as `data-theme` on <html>, re-skinning the whole app. The palettes
 * themselves live in src/app/globals.css.
 */

export const THEME_COOKIE = 'fh_theme';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /** Swatches for the picker: [background, ink, accent, accentSoft]. */
  swatch: { bg: string; ink: string; accent: string; soft: string };
  /** Card corner feel, mirrored from --radius-card for the preview tile. */
  radius: string;
}

export const THEMES = [
  {
    id: 'navy',
    name: 'Deep Navy',
    tagline: 'Trusted · calm · quietly premium',
    swatch: { bg: '#F6F8FB', ink: '#0F2A4A', accent: '#2F6FED', soft: '#E7EEFD' },
    radius: '1.25rem',
  },
  {
    id: 'hearth',
    name: 'Warm Hearth',
    tagline: 'Homey · human · reassuring',
    swatch: { bg: '#F7F1E7', ink: '#37302A', accent: '#B4552D', soft: '#F0DCCB' },
    radius: '1.25rem',
  },
  {
    id: 'campus',
    name: 'Fresh Campus',
    tagline: 'Energetic · optimistic · bright',
    swatch: { bg: '#F4FBF8', ink: '#0C2E2A', accent: '#0E9E8E', soft: '#D4F2EC' },
    radius: '1.25rem',
  },
  {
    id: 'ink',
    name: 'Editorial Ink',
    tagline: 'Refined · minimal · literary',
    swatch: { bg: '#FAF9F6', ink: '#1C1B1A', accent: '#6E3355', soft: '#EFE1EA' },
    radius: '0.4rem',
  },
] as const satisfies readonly ThemeMeta[];

export type ThemeId = 'navy' | 'hearth' | 'campus' | 'ink';

export const DEFAULT_THEME: ThemeId = 'navy';

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && THEMES.some((t) => t.id === v);
}

export function resolveTheme(v: unknown): ThemeId {
  return isThemeId(v) ? v : DEFAULT_THEME;
}
