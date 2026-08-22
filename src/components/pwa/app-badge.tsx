'use client';

import { useEffect } from 'react';

/** Sets the installed-PWA app-icon badge to the unread total (where supported). */
export function AppBadge({ total }: { total: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    try {
      if (total > 0) void nav.setAppBadge(total);
      else void nav.clearAppBadge?.();
    } catch { /* unsupported context */ }
  }, [total]);
  return null;
}
