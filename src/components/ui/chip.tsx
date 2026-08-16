import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chipVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        brand: 'bg-brand-muted text-brand',
        success: 'bg-success-soft text-success',
        attention: 'bg-attention-soft text-attention',
        danger: 'bg-danger-soft text-danger',
        navy: 'bg-navy text-white',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

export function Chip({ className, tone, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}
