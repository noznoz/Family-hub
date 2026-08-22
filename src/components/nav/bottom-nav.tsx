'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { primaryNav } from './nav-items';
import { tNav, type Locale } from '@/lib/locale';
import { cn } from '@/lib/utils';

export function BottomNav({ locale = 'en', chatUnread = 0 }: { locale?: Locale; chatUnread?: number }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors',
                  active ? 'text-brand' : 'text-muted-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  <Icon className={cn('size-6', active && 'stroke-[2.5]')} />
                  {href === '/chat' && chatUnread > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                      {chatUnread > 9 ? '9+' : chatUnread}
                    </span>
                  )}
                </span>
                {tNav(label, locale)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
