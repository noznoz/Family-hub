'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { primaryNav, moreNav } from './nav-items';
import { tNav, type Locale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/brand/app-logo';

export function Sidebar({ locale = 'en' }: { locale?: Locale }) {
  const pathname = usePathname();
  const items = [...primaryNav.filter((i) => i.href !== '/more'), ...moreNav];
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-white md:flex md:flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <AppLogo className="size-9" />
        <span className="text-lg font-extrabold tracking-tight text-navy">Family Hub</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6" aria-label="Primary">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                active ? 'bg-brand-muted text-brand' : 'text-navy-600 hover:bg-muted',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-5" />
              {tNav(label, locale)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
