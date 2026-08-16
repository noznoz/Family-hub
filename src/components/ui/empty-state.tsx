import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  hint,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white/60 p-8 text-center', className)}>
      {icon && <div className="mb-2 text-navy-300">{icon}</div>}
      <p className="font-semibold text-navy">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
