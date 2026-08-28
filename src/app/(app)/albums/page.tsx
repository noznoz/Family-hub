import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/session';
import { getAlbums } from '@/lib/album-queries';
import { AlbumGrid } from '@/components/albums/album-grid';

export const metadata: Metadata = { title: 'Albums' };
export const dynamic = 'force-dynamic';

export default async function AlbumsPage() {
  const session = await getSessionUser();
  if (!session) return null;
  const albums = session.isDemo ? [] : await getAlbums(session.familyId).catch(() => []);
  return <AlbumGrid albums={albums} live={!session.isDemo} />;
}
