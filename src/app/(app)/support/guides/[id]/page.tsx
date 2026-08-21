import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { getGuide } from '@/lib/support-queries';
import { Card } from '@/components/ui/card';
import { GuideHeaderActions } from '@/components/support/guide-header-actions';

export const metadata: Metadata = { title: 'Guide' };

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionUser();
  const guide = await getGuide(id);
  if (!guide) notFound();
  const canEdit = !!session && can(session.member.role, 'create_support');

  return (
    <div className="space-y-5">
      <Link href="/support" className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><ChevronLeft className="size-4" /> Support</Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">{guide.title}</h1>
          {guide.description && <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>}
        </div>
        {canEdit && <GuideHeaderActions guide={guide} live={!session?.isDemo} />}
      </div>
      {guide.warnings && (
        <Card className="flex items-start gap-2 border-attention/30 bg-attention-soft p-4 text-sm text-attention">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {guide.warnings}
        </Card>
      )}
      <ol className="space-y-2">
        {guide.steps.map((s) => (
          <Card key={s.no} className="flex gap-3 p-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{s.no}</span>
            <p className="pt-0.5 text-navy">{s.body}</p>
          </Card>
        ))}
      </ol>
    </div>
  );
}
