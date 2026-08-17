'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';
import { can } from '@/lib/permissions';

type Result = { ok: true } | { ok: false; error: string };

async function guard() {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: 'Not signed in.' };
  if (!can(session.member.role, 'manage_documents')) return { ok: false as const, error: 'No permission to manage documents.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, error: 'Backend unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  return { ok: true as const, session, supabase, userId: user?.id ?? null };
}

export interface DocInput {
  name: string;
  category: string;
  studentId?: string | null;
  visibility: string;
  expiry?: string | null;
  reminder?: string | null;
  notes?: string;
  storagePath: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export async function createDocument(input: DocInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: 'Name is required.' };
  if (!input.storagePath) return { ok: false, error: 'Upload the file first.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;

  const { data: doc, error } = await g.supabase.from('documents').insert({
    family_id: g.session.familyId,
    student_id: input.studentId || null,
    name: input.name.trim(),
    category: input.category,
    visibility: input.visibility,
    expiry_date: input.expiry || null,
    reminder_date: input.reminder || null,
    notes: input.notes || null,
    uploaded_by: g.userId,
  }).select('id').single();
  if (error || !doc) return { ok: false, error: error?.message ?? 'Failed to save document.' };

  await g.supabase.from('document_versions').insert({
    document_id: doc.id,
    version: 1,
    storage_path: input.storagePath,
    file_name: input.fileName || null,
    mime_type: input.mimeType || null,
    size_bytes: input.sizeBytes || null,
    uploaded_by: g.userId,
  });

  await g.supabase.from('audit_logs').insert({
    family_id: g.session.familyId, actor_id: g.userId, action: 'document.create', entity: 'document', entity_id: doc.id, meta: {},
  });

  revalidatePath('/documents');
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { error } = await g.supabase.from('documents').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  await g.supabase.from('audit_logs').insert({
    family_id: g.session.familyId, actor_id: g.userId, action: 'document.delete', entity: 'document', entity_id: id, meta: {},
  });
  revalidatePath('/documents');
  return { ok: true };
}
