import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Live exchange rates (base GBP) from Frankfurter (ECB data, free, no key).
 * Cached in app_config for ~12h so we don't hit the API on every request, with
 * a static fallback so money always renders even if the API is unreachable.
 */
export { CURRENCY_COOKIE, CURRENCIES, resolveCurrency, convert, type Currency } from '@/lib/currency';

export interface FxRates { base: 'GBP'; rates: Record<string, number>; fetchedAt: number }

const FALLBACK: FxRates = { base: 'GBP', rates: { GBP: 1, USD: 1.27, EUR: 1.17, SAR: 4.76, AED: 4.66 }, fetchedAt: 0 };
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export async function getFx(): Promise<FxRates> {
  const admin = createAdminClient();
  // Try cache.
  if (admin) {
    const { data } = await admin.from('app_config').select('value').eq('key', 'fx_rates').maybeSingle();
    if (data?.value) {
      try {
        const cached = JSON.parse(data.value) as FxRates;
        if (cached.rates?.GBP && Date.now() - (cached.fetchedAt ?? 0) < MAX_AGE_MS) return cached;
      } catch { /* ignore */ }
    }
  }
  // Refresh from the API.
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=GBP&to=USD,EUR,SAR,AED', { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number> };
      const fresh: FxRates = { base: 'GBP', rates: { GBP: 1, ...(json.rates ?? {}) }, fetchedAt: Date.now() };
      if (admin) await admin.from('app_config').upsert({ key: 'fx_rates', value: JSON.stringify(fresh) }, { onConflict: 'key' });
      return fresh;
    }
  } catch { /* fall through */ }
  return FALLBACK;
}
