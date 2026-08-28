import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getAlbum } from '@/lib/album-queries';
import { AlbumDetailView } from '@/components/albums/album-detail';

export const metadata: Metadata = { title: 'Album' };
export const dynamic = 'force-dynamic';

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) return null;
  if (session.isDemo) notFound();

  const album = await getAlbum(id);
  if (!album) notFound();

  return <AlbumDetailView album={album} familyId={session.familyId} live={!session.isDemo} />;
}
