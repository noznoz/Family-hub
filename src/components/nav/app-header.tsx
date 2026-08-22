'use client';

import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
import { AppLogo } from '@/components/brand/app-logo';
import { Avatar } from '@/components/ui/avatar';

export function AppHeader({ name, notifUnread = 0 }: { name: string; notifUnread?: number }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-white/90 px-4 py-3 backdrop-blur safe-top md:hidden">
      <Link href="/home" className="flex items-center gap-2">
        <AppLogo className="size-8" />
        <span className="font-extrabold tracking-tight text-navy">Family Hub</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/search" aria-label="Search" className="rounded-full p-1.5 hover:bg-muted">
          <Search className="size-5 text-navy" />
        </Link>
        <Link href="/notifications" aria-label="Notifications" className="relative rounded-full p-1.5 hover:bg-muted">
          <Bell className="size-5 text-navy" />
          {notifUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {notifUnread > 9 ? '9+' : notifUnread}
            </span>
          )}
        </Link>
        <Link href="/profile" aria-label="Profile">
          <Avatar name={name} size="sm" />
        </Link>
      </div>
    </header>
  );
}
