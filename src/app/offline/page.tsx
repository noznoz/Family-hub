export const dynamic = 'force-static';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-4xl">📶</div>
      <p className="text-lg font-bold text-navy">You&apos;re offline</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Some saved pages are still available. Reconnect to load the latest updates and to make
        changes such as approving payments or uploading documents.
      </p>
    </main>
  );
}
