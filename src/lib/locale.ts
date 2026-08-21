/**
 * Lightweight locale support. A per-member choice (cookie) flips the app to
 * Arabic + RTL. Navigation and common chrome are translated here; screen body
 * copy remains English for now and can be expanded from this dictionary.
 */
export const LOCALE_COOKIE = 'fh_locale';
export type Locale = 'en' | 'ar';

export const LOCALES: { id: Locale; label: string; dir: 'ltr' | 'rtl' }[] = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'ar', label: 'العربية', dir: 'rtl' },
];

export function resolveLocale(v: unknown): Locale {
  return v === 'ar' ? 'ar' : 'en';
}
export function dirFor(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Navigation + common label translations, keyed by the English label. */
const NAV: Record<string, string> = {
  Home: 'الرئيسية', Chat: 'المحادثة', Tasks: 'المهام', Money: 'المال', More: 'المزيد',
  'My profile': 'ملفي', 'Prayer times': 'مواقيت الصلاة', Support: 'المساعدة', Travel: 'السفر',
  Documents: 'المستندات', Family: 'العائلة', Accommodation: 'السكن', University: 'الجامعة',
  Scholarship: 'المنحة', Calendar: 'التقويم', 'Activity log': 'سجل النشاط', Settings: 'الإعدادات',
};

export function tNav(label: string, locale: Locale): string {
  return locale === 'ar' ? (NAV[label] ?? label) : label;
}
