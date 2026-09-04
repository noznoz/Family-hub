'use client';

import { useEffect, useState } from 'react';
import { BellRing, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { subscribeToPush, sendTestPush } from '@/lib/actions/push';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = 'checking' | 'unsupported' | 'ios-install' | 'idle' | 'enabling' | 'enabled' | 'denied' | 'error';

export function EnableNotifications({ hideWhenEnabled = false }: { hideWhenEnabled?: boolean }) {
  const [state, setState] = useState<State>('checking');
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      // iOS Safari only supports push from an installed (home-screen) PWA.
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
      setState(isIos && !standalone ? 'ios-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'enabled' : 'idle'))
      .catch(() => setState('idle'));
  }, []);

  const enable = async () => {
    setError(null);
    setState('enabling');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return; }
      const reg = await navigator.serviceWorker.ready;
      const res = await fetch('/api/push/vapid');
      if (!res.ok) { setError('Notifications aren’t configured yet. Try again shortly.'); setState('error'); return; }
      const { publicKey } = await res.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const saved = await subscribeToPush(
        { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
        navigator.userAgent,
      );
      if (!saved.ok) { setError(saved.error); setState('error'); return; }
      setState('enabled');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.');
      setState('error');
    }
  };

  const test = async () => { await sendTestPush(); setTested(true); setTimeout(() => setTested(false), 4000); };

  if (state === 'checking') return null;
  // On Home we only want this to appear when action is needed — hide it once
  // notifications are on (or can't be offered here).
  if (hideWhenEnabled && (state === 'enabled' || state === 'unsupported' || state === 'denied')) return null;

  if (state === 'ios-install') {
    return (
      <div className="rounded-xl bg-brand-muted p-3 text-sm text-navy">
        <p className="font-semibold">Turn on notifications</p>
        <p className="mt-0.5 text-muted-foreground">On iPhone, first add Family Hub to your Home Screen (Share → Add to Home Screen), then open it from there and enable notifications.</p>
      </div>
    );
  }
  if (state === 'unsupported') {
    return <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Notifications aren’t supported on this browser.</p>;
  }
  if (state === 'denied') {
    return <p className="rounded-xl bg-attention-soft p-3 text-sm text-attention">Notifications are blocked. Enable them for this site in your browser settings.</p>;
  }

  if (state === 'enabled') {
    return (
      <div className="flex items-center gap-2">
        <span className="flex flex-1 items-center gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm font-semibold text-success">
          <Check className="size-4" /> Notifications on
        </span>
        <Button variant="outline" size="sm" onClick={test}>{tested ? 'Sent!' : 'Send test'}</Button>
      </div>
    );
  }

  return (
    <div>
      <Button variant="brand" className="w-full" onClick={enable} disabled={state === 'enabling'}>
        {state === 'enabling' ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
        {state === 'enabling' ? 'Enabling…' : 'Enable notifications'}
      </Button>
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
