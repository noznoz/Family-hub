import { cn } from '@/lib/utils';

/** Inline Family Hub logo mark (matches the PWA icon). */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('rounded-[22%]', className)} role="img" aria-label="Family Hub">
      <rect width="512" height="512" rx="112" fill="#0F2A4A" />
      <path
        d="M256 150 L156 232 V360 a16 16 0 0 0 16 16 H340 a16 16 0 0 0 16-16 V232 Z"
        fill="none" stroke="#fff" strokeWidth="20" strokeLinejoin="round"
      />
      <g fill="#fff">
        <path d="M256 96 L336 132 L256 168 L176 132 Z" />
        <rect x="330" y="132" width="8" height="52" rx="4" />
        <circle cx="334" cy="188" r="10" />
        <circle cx="222" cy="292" r="17" />
        <path d="M196 352 a26 26 0 0 1 52 0 Z" />
        <circle cx="290" cy="292" r="17" />
        <path d="M264 352 a26 26 0 0 1 52 0 Z" />
        <circle cx="256" cy="312" r="12" />
        <path d="M238 352 a18 18 0 0 1 36 0 Z" />
      </g>
      <g>
        <rect x="176" y="366" width="53" height="10" rx="5" fill="#C8102E" />
        <rect x="229" y="366" width="54" height="10" rx="5" fill="#fff" opacity="0.9" />
        <rect x="283" y="366" width="53" height="10" rx="5" fill="#1D3FB0" />
      </g>
    </svg>
  );
}
