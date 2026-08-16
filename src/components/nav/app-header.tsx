'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { AppLogo } from '@/components/brand/app-logo';
import { Avatar } from '@/components/ui/avatar';

export function AppHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-white/90 px-4 py-3 backdrop-blur safe-top md:hidden">
      <Link href="/home" className="flex items-center gap-2">
        <AppLogo className="size-8" />
        <span className="font-extrabold tracking-tight text-navy">Family Hub</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/notifications" aria-label="Notifications" className="relative rounded-full p-1.5 hover:bg-muted">
          <Bell className="size-5 text-navy" />
          <span className="absolute right-1 top-1 size-2 rounded-full bg-danger" />
        </Link>
        <Link href="/settings" aria-label="Profile">
          <Avatar name={name} size="sm" />
        </Link>
      </div>
    </header>
  );
}
