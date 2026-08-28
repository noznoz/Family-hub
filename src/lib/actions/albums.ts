'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/env';

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function ctx() {
  const session = await getSessionUser();
  if (!session) return { ok: false as const, error: 'Not signed in.' };
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, error: 'Backend unavailable.' };
  const { data: { user } } = await supabase.auth.getUser();
  return { ok: true as const, session, supabase, userId: user?.id ?? null };
}

export async function createAlbum(input: { title: string; description?: string }): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Give the album a name.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { data, error } = await c.supabase.from('albums').insert({
    family_id: c.session.familyId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    created_by: c.userId,
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/albums');
  return { ok: true, id: data?.id };
}

export async function updateAlbum(input: { id: string; title: string; description?: string }): Promise<Result> {
  if (!input.title.trim()) return { ok: false, error: 'Give the album a name.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from('albums')
    .update({ title: input.title.trim(), description: input.description?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/albums');
  revalidatePath(`/albums/${input.id}`);
  return { ok: true };
}

export async function deleteAlbum(id: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from('albums').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/albums');
  return { ok: true };
}

/** Record one uploaded photo (the file is uploaded client-side to storage). */
export async function addAlbumPhoto(input: { albumId: string; storagePath: string; caption?: string }): Promise<Result> {
  if (!input.storagePath) return { ok: false, error: 'Upload failed.' };
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { data, error } = await c.supabase.from('album_photos').insert({
    album_id: input.albumId,
    family_id: c.session.familyId,
    storage_path: input.storagePath,
    caption: input.caption?.trim() || null,
    uploaded_by: c.userId,
  }).select('id').single();
  if (error) return { ok: false, error: error.message };

  // First photo added becomes the album cover, and bumps the album's timestamp.
  await c.supabase.from('albums')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.albumId);
  const { data: album } = await c.supabase.from('albums').select('cover_photo_id').eq('id', input.albumId).maybeSingle();
  if (album && !album.cover_photo_id && data) {
    await c.supabase.from('albums').update({ cover_photo_id: data.id }).eq('id', input.albumId);
  }

  revalidatePath('/albums');
  revalidatePath(`/albums/${input.albumId}`);
  return { ok: true, id: data?.id };
}

export async function deleteAlbumPhoto(photoId: string, albumId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from('album_photos').delete().eq('id', photoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/albums');
  revalidatePath(`/albums/${albumId}`);
  return { ok: true };
}

export async function setPhotoCaption(photoId: string, albumId: string, caption: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from('album_photos').update({ caption: caption.trim() || null }).eq('id', photoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/albums/${albumId}`);
  return { ok: true };
}

export async function setAlbumCover(photoId: string, albumId: string): Promise<Result> {
  if (!isSupabaseConfigured) return { ok: true };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from('albums').update({ cover_photo_id: photoId }).eq('id', albumId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/albums');
  revalidatePath(`/albums/${albumId}`);
  return { ok: true };
}
