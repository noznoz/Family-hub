'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card-hover md:inset-0 md:bottom-auto md:top-1/2 md:mt-0 md:-translate-y-1/2 md:rounded-3xl',
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-center justify-between">
          <DialogPrimitive.Title className="text-lg font-bold text-navy">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-full p-1.5 text-navy-400 hover:bg-muted" aria-label="Close">
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
