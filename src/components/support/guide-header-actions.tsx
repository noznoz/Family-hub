'use client';

import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteButton } from '@/components/ui/delete-button';
import { GuideFormDialog } from './guide-form-dialog';
import { deleteGuide } from '@/lib/actions/support';
import type { GuideDetail } from '@/lib/support-queries';

export function GuideHeaderActions({ guide, live }: { guide: GuideDetail; live: boolean }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-1">
      <GuideFormDialog live={live} guide={guide}
        trigger={<Button variant="outline" size="sm"><Pencil className="size-4" /> Edit</Button>} />
      <DeleteButton
        itemLabel={`“${guide.title}”`} title="Delete guide" iconOnly={false} className="border border-border"
        onConfirm={() => (live ? deleteGuide(guide.id) : Promise.resolve())}
        onDeleted={() => router.push('/support')}
      />
    </div>
  );
}
