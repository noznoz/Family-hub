import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Email sending via Resend's HTTP API. The API key and from-address live in
 * app_config (set later, like the VAPID keys) so no code change is needed to
 * turn email on. If no key is configured this is a graceful no-op — the rest of
 * the notification (in-app + push) still happens.
 */
export interface EmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function isEmailConfigured(): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.from('app_config').select('value').eq('key', 'resend_api_key').maybeSingle();
  return !!data?.value;
}

export async function sendEmail(input: EmailInput): Promise<{ ok: boolean; skipped?: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false };
  const { data } = await admin.from('app_config').select('key, value').in('key', ['resend_api_key', 'email_from']);
  const key = data?.find((r) => r.key === 'resend_api_key')?.value;
  const from = data?.find((r) => r.key === 'email_from')?.value || 'Family Hub <onboarding@resend.dev>';
  if (!key) return { ok: false, skipped: true };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    return { ok: res.ok };
  } catch (e) {
    console.error('[sendEmail] failed:', e instanceof Error ? e.message : String(e));
    return { ok: false };
  }
}

/** Minimal branded HTML wrapper so emails look consistent. */
export function emailShell(heading: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string): string {
  const cta = ctaLabel && ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:16px;background:#2F6FED;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px">${ctaLabel}</a>`
    : '';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F2A4A">
    <p style="font-weight:800;font-size:18px;margin:0 0 4px">Family Hub</p>
    <h1 style="font-size:20px;margin:12px 0 8px">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#33415c">${bodyHtml}</div>
    ${cta}
  </div>`;
}
