import { cn } from '@/lib/utils';
import { initials } from '@/lib/utils';

const palette = ['bg-navy', 'bg-brand', 'bg-success', 'bg-attention', 'bg-navy-500', 'bg-brand-soft'];

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dim = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  const color = palette[name.charCodeAt(0) % palette.length];
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        dim,
        color,
        className,
      )}
      aria-hidden={!src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}
