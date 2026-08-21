'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Trash button that opens a confirmation dialog, then runs `onConfirm` (usually
 * a server action). On success it calls `onDeleted` so the caller can drop the
 * row from local state. Used across every list so delete looks/behaves the same.
 */
export function DeleteButton({
  onConfirm,
  onDeleted,
  itemLabel = 'this item',
  title = 'Delete',
  className,
  iconOnly = true,
}: {
  onConfirm: () => Promise<{ ok: boolean; error?: string } | void>;
  onDeleted?: () => void;
  itemLabel?: string;
  title?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await onConfirm();
      if (res && 'ok' in res && !res.ok) {
        setError(res.error ?? 'Could not delete.');
        return;
      }
      setOpen(false);
      onDeleted?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${itemLabel}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg text-danger transition-colors hover:bg-danger-soft',
          iconOnly ? 'size-8 justify-center' : 'px-2.5 py-1.5 text-sm font-semibold',
          className,
        )}
      >
        <Trash2 className="size-4" />
        {!iconOnly && 'Delete'}
      </button>
      <DialogContent title={title}>
        <p className="text-sm text-muted-foreground">
          Delete {itemLabel}? This can’t be undone.
        </p>
        {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="flex-1">Cancel</Button>
          </DialogClose>
          <Button type="button" variant="danger" className="flex-1" disabled={pending} onClick={confirm}>
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
