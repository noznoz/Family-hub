'use client';

import { cn } from '@/lib/utils';

/** WhatsApp brand glyph. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.2 5.07 4.48.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5.01c0-5.18 4.22-9.4 9.41-9.4 2.51 0 4.87.98 6.64 2.76a9.34 9.34 0 0 1 2.75 6.65c-.01 5.18-4.22 9.4-9.4 9.4zm8-17.4A11.32 11.32 0 0 0 12.04.75C5.8.75.72 5.83.72 12.06c0 2 .52 3.95 1.52 5.67L.63 23.5l5.9-1.55a11.3 11.3 0 0 0 5.5 1.4h.01c6.24 0 11.32-5.08 11.32-11.32 0-3.03-1.18-5.87-3.32-8.01z" />
    </svg>
  );
}

/**
 * Share an item to WhatsApp. Opens WhatsApp (app on mobile, web on desktop)
 * with a prefilled message describing the item. Works everywhere via wa.me.
 */
export function ShareButton({
  text, url, className, label,
}: {
  text: string;
  url?: string;
  className?: string;
  label?: string;
}) {
  const share = () => {
    const abs = url && url.startsWith('/') ? `${window.location.origin}${url}` : url;
    const message = abs ? `${text}\n\n${abs}` : text;
    const href = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share to WhatsApp"
      title="Share to WhatsApp"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg text-[#25D366] transition-colors hover:bg-[#25D366]/10',
        label ? 'px-2.5 py-1.5 text-sm font-semibold' : 'size-8 justify-center',
        className,
      )}
    >
      <WhatsAppIcon className="size-[18px]" />
      {label}
    </button>
  );
}
