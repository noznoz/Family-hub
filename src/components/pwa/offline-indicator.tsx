'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Shows a slim banner when the device goes offline. */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-attention px-4 py-1.5 text-xs font-semibold text-white"
    >
      <WifiOff className="size-3.5" />
      You&apos;re offline — showing saved information. Sensitive changes need a connection.
    </div>
  );
}
