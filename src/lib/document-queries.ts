import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { signDocsMany } from '@/lib/signed-urls';

function one<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}


export type ExpiryState = 'ok' | 'soon' | 'expired' | 'none';

export interface DocView {
  id: string; name: string; category: string; student: string | null;
  studentId: string | null; expiryDate: string | null;
  expiry: string | null; expiryState: ExpiryState; notes: string;
  visibility: string; url: string | null; uploadedOn: string;
  versionCount: number; sharedMemberIds: string[];
}

function expiryState(date: string | null): ExpiryState {
  if (!date) return 'none';
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= 90) return 'soon';
  return 'ok';
}

export async function getDocuments(familyId: string): Promise<DocView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('documents')
    .select('id, name, category, expiry_date, notes, visibility, created_at, student_id, student:student_profiles(member:family_members!student_profiles_member_id_fkey(display_name)), versions:document_versions(storage_path, version), shares:document_shares(member_id)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false });
  if (error) console.error('[getDocuments]', error.code, error.message);

  const rows = data ?? [];
  // Newest version per document, then sign them all in one request.
  const latest = new Map<string, string | null>();
  for (const d of rows) {
    const versions = ((d.versions as { storage_path: string; version: number }[]) ?? []).sort((a, b) => b.version - a.version);
    latest.set(d.id, versions[0]?.storage_path ?? null);
  }
  const signedUrls = await signDocsMany([...latest.values()]);

  return rows.map((d) => {
    const versions = ((d.versions as { storage_path: string; version: number }[]) ?? []).sort((a, b) => b.version - a.version);
    const path = latest.get(d.id) ?? null;
    return {
      id: d.id,
      name: d.name,
      category: d.category,
      student: one<{ member: { display_name: string } | null }>(d.student)?.member?.display_name ?? null,
      studentId: (d as { student_id?: string | null }).student_id ?? null,
      expiryDate: d.expiry_date ?? null,
      expiry: d.expiry_date ? new Date(d.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
      expiryState: expiryState(d.expiry_date),
      notes: d.notes ?? '',
      visibility: d.visibility,
      url: path ? signedUrls.get(path) ?? null : null,
      uploadedOn: new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      versionCount: versions.length,
      sharedMemberIds: (((d as { shares?: { member_id: string }[] }).shares) ?? []).map((s) => s.member_id),
    };
  });
}

export async function getStudentOptions(familyId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('student_profiles')
    .select('id, member:family_members!student_profiles_member_id_fkey(display_name)')
    .eq('family_id', familyId);
  return (data ?? []).map((s) => ({ id: s.id, name: one<{ display_name: string }>(s.member)?.display_name ?? 'Student' }));
}
