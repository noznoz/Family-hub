import type { Metadata, Viewport } from 'next';
import './globals.css';
import { env } from '@/lib/env';
import { PwaRegister } from '@/components/pwa/pwa-register';

const appUrl = env.NEXT_PUBLIC_PRODUCTION_DOMAIN || env.NEXT_PUBLIC_APP_URL;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: 'Family Hub',
  title: { default: 'Family Hub', template: '%s · Family Hub' },
  description: 'Private family app for the UK university journey of Hamza and Omar.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Family Hub' },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0F2A4A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
