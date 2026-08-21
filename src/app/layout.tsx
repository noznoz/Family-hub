import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Plus_Jakarta_Sans, Nunito_Sans, DM_Sans, Newsreader } from 'next/font/google';
import './globals.css';
import { env } from '@/lib/env';
import { PwaRegister } from '@/components/pwa/pwa-register';
import { THEME_COOKIE, resolveTheme } from '@/lib/theme';
import { getSessionUser } from '@/lib/session';

const appUrl = env.NEXT_PUBLIC_PRODUCTION_DOMAIN || env.NEXT_PUBLIC_APP_URL;

// One body font per theme, selected via --font-sans in globals.css.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });
const nunito = Nunito_Sans({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader', display: 'swap' });
const fontVars = `${jakarta.variable} ${nunito.variable} ${dmSans.variable} ${newsreader.variable}`;

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  // The account's saved theme wins (follows the member across devices); the
  // cookie is the fast fallback and the store for demo mode / signed-out pages.
  const session = await getSessionUser().catch(() => null);
  const theme = resolveTheme(session?.member.theme ?? store.get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} className={fontVars}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
