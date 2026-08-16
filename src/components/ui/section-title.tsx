import { cn } from '@/lib/utils';

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between px-1', className)}>
      <h2 className="text-base font-bold text-navy">{children}</h2>
      {action}
    </div>
  );
}
