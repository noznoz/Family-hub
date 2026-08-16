import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { AttentionItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const dot: Record<AttentionItem['tone'], string> = {
  danger: 'bg-danger',
  attention: 'bg-attention',
  brand: 'bg-brand',
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Nothing needs attention 🎉" hint="You're all caught up." />;
  }
  return (
    <Card className="divide-y divide-border">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 p-4">
          <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', dot[item.tone])} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </div>
          <AlertTriangle className="size-4 shrink-0 text-navy-200" />
        </div>
      ))}
    </Card>
  );
}
