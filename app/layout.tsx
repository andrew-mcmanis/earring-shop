import type { Metadata, Viewport } from 'next';
import { Amatic_SC, Cabin } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { CartProvider } from './components/CartProvider';
import { CartDrawer } from './components/CartDrawer';
import { SITE_URL } from './lib/site';

const amaticSC = Amatic_SC({
  weight: ['400', '700'],
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
});

const cabin = Cabin({
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'BLG Creations — Handmade Jewellery & Gifts',
    template: '%s · BLG Creations',
  },
  description:
    'Earrings, bookmarks and gifts — every piece made by hand.',
  openGraph: {
    type: 'website',
    siteName: 'BLG Creations',
    title: 'BLG Creations — Handmade Jewellery & Gifts',
    description:
      'Earrings, bookmarks and gifts — every piece made by hand.',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BLG Creations — Handmade Jewellery & Gifts',
    description: 'Earrings, bookmarks and gifts — every piece made by hand.',
  },
};

export const viewport: Viewport = {
  themeColor: '#FDF8F0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className={`${amaticSC.variable} ${cabin.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
