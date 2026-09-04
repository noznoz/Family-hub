import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { signMediaMany } from '@/lib/signed-urls';

export interface AlbumSummary {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  count: number;
  updatedAt: string | null;
}

export interface AlbumPhoto {
  id: string;
  url: string | null;
  caption: string | null;
  isCover: boolean;
}

export interface AlbumDetail {
  id: string;
  title: string;
  description: string | null;
  photos: AlbumPhoto[];
  createdBy: string | null;
}

/** All albums in the family, with a cover thumbnail and photo count. */
export async function getAlbums(familyId: string): Promise<AlbumSummary[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('albums')
    .select('id, title, description, cover_photo_id, updated_at, photos:album_photos(id, storage_path)')
    .eq('family_id', familyId)
    .order('updated_at', { ascending: false });
  if (error) { console.error('[getAlbums]', error.message); return []; }

  // Pick each album's cover first, then sign every thumbnail in one request.
  const rows = (data ?? []).map((a) => {
    const photos = (a as { photos?: { id: string; storage_path: string }[] }).photos ?? [];
    const cover = photos.find((p) => p.id === (a as { cover_photo_id?: string | null }).cover_photo_id) ?? photos[0];
    return { a, photos, coverPath: cover?.storage_path ?? null };
  });
  const signed = await signMediaMany(rows.map((r) => r.coverPath));

  return rows.map(({ a, photos, coverPath }) => ({
    id: a.id,
    title: a.title,
    description: a.description ?? null,
    coverUrl: coverPath ? signed.get(coverPath) ?? null : null,
    count: photos.length,
    updatedAt: a.updated_at
      ? new Date(a.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null,
  }));
}

/** One album with all its photos (signed URLs), newest first. */
export async function getAlbum(albumId: string): Promise<AlbumDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: album } = await supabase
    .from('albums')
    .select('id, title, description, cover_photo_id, created_by')
    .eq('id', albumId)
    .maybeSingle();
  if (!album) return null;

  const { data: rows } = await supabase
    .from('album_photos')
    .select('id, storage_path, caption, created_at')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false });

  const coverId = (album as { cover_photo_id?: string | null }).cover_photo_id ?? null;
  const signed = await signMediaMany((rows ?? []).map((p) => p.storage_path));
  const photos = (rows ?? []).map((p) => ({
    id: p.id,
    url: signed.get(p.storage_path) ?? null,
    caption: p.caption ?? null,
    isCover: p.id === coverId,
  }));

  return {
    id: album.id,
    title: album.title,
    description: album.description ?? null,
    photos,
    createdBy: (album as { created_by?: string | null }).created_by ?? null,
  };
}
