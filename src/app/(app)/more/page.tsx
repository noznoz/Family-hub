import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ChevronRight } from 'lucide-react';
import { moreNav } from '@/components/nav/nav-items';
import { Card } from '@/components/ui/card';
import { LOCALE_COOKIE, resolveLocale, tNav } from '@/lib/locale';

export const metadata: Metadata = { title: 'More' };

export default async function MorePage() {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy">{tNav('More', locale)}</h1>
      <Card className="divide-y divide-border">
        {moreNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 p-4 hover:bg-muted">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-muted text-brand">
              <Icon className="size-5" />
            </span>
            <span className="flex-1 font-semibold text-navy">{tNav(label, locale)}</span>
            <ChevronRight className="size-5 text-navy-200" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
