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
  if (!can(session.member.role, 'manage_documents', session.overrides)) return { ok: false as const, error: 'No permission to manage documents.' };
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
  shareMemberIds?: string[];
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

  if (input.visibility === 'selected_members' && input.shareMemberIds?.length) {
    await g.supabase.from('document_shares').insert(
      input.shareMemberIds.map((member_id) => ({ document_id: doc.id, member_id })),
    );
  }

  await g.supabase.from('audit_logs').insert({
    family_id: g.session.familyId, actor_id: g.userId, action: 'document.create', entity: 'document', entity_id: doc.id, meta: {},
  });

  revalidatePath('/documents');
  return { ok: true };
}

export interface UpdateDocInput {
  id: string;
  name: string;
  category: string;
  studentId?: string | null;
  visibility: string;
  expiry?: string | null;
  notes?: string;
}

/** Edit a document's metadata (no re-upload). */
export async function updateDocument(input: UpdateDocInput): Promise<Result> {
  if (!input.name.trim()) return { ok: false, error: 'Name is required.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;

  const { error } = await g.supabase.from('documents').update({
    name: input.name.trim(),
    category: input.category,
    student_id: input.studentId || null,
    visibility: input.visibility,
    expiry_date: input.expiry || null,
    notes: input.notes || null,
  }).eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  await g.supabase.from('audit_logs').insert({
    family_id: g.session.familyId, actor_id: g.userId, action: 'document.update', entity: 'document', entity_id: input.id, meta: {},
  });
  revalidatePath('/documents');
  return { ok: true };
}

/** Upload a new version of a document (bumps the version number). */
export async function addDocumentVersion(input: {
  documentId: string; storagePath: string; fileName?: string; mimeType?: string; sizeBytes?: number;
}): Promise<Result> {
  if (!input.storagePath) return { ok: false, error: 'Upload the file first.' };
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  const { data: latest } = await g.supabase
    .from('document_versions').select('version').eq('document_id', input.documentId)
    .order('version', { ascending: false }).limit(1).maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;
  const { error } = await g.supabase.from('document_versions').insert({
    document_id: input.documentId, version: nextVersion, storage_path: input.storagePath,
    file_name: input.fileName || null, mime_type: input.mimeType || null, size_bytes: input.sizeBytes || null,
    uploaded_by: g.userId,
  });
  if (error) return { ok: false, error: error.message };
  await g.supabase.from('documents').update({ updated_at: new Date().toISOString() }).eq('id', input.documentId);
  revalidatePath('/documents');
  return { ok: true };
}

/** Replace the set of members a 'selected_members' document is shared with. */
export async function setDocumentShares(documentId: string, memberIds: string[]): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const g = await guard();
  if (!g.ok) return g;
  await g.supabase.from('document_shares').delete().eq('document_id', documentId);
  if (memberIds.length) {
    await g.supabase.from('document_shares').insert(memberIds.map((member_id) => ({ document_id: documentId, member_id })));
  }
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
