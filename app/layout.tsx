import type { Metadata } from 'next';
import { Amatic_SC, Cabin } from 'next/font/google';
import './globals.css';
import { CartProvider } from './components/CartProvider';
import { CartDrawer } from './components/CartDrawer';

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
  title: 'BLG Creations',
  description:
    'Handcrafted earrings made with love — shop unique designs in gold, silver, brass and more.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${amaticSC.variable} ${cabin.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
