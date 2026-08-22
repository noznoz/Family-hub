/** Client-safe currency constants (no server-only imports). */
export const CURRENCY_COOKIE = 'fh_currency';
export const CURRENCIES = ['GBP', 'SAR', 'USD', 'EUR', 'AED'] as const;
export type Currency = string;

export function resolveCurrency(v: unknown): Currency {
  return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v) ? v : 'GBP';
}

/** Convert using GBP-based rates. */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  const rFrom = from === 'GBP' ? 1 : rates[from];
  const rTo = to === 'GBP' ? 1 : rates[to];
  if (!rFrom || !rTo) return amount;
  return (amount / rFrom) * rTo;
}
