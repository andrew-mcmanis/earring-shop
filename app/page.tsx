import { Header } from './components/Header';
import { ShopContent } from './components/ShopContent';

export default function Home() {
  return (
    <>
      <Header />

      <section className="bg-ink text-cream py-14 px-4 text-center">
        <p className="font-body text-xs font-semibold tracking-[0.3em] uppercase text-kraft-light mb-3">
          Handcrafted with Love
        </p>
        <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold mb-4 leading-tight">
          Unique Earrings for Every Style
        </h1>
        <p className="font-body text-sm text-cream/70 max-w-sm mx-auto leading-relaxed">
          Each piece is made to order. Browse our handcrafted collection in gold, silver, brass, and
          more.
        </p>
      </section>

      <ShopContent />

      <footer className="mt-auto border-t border-cream-dark py-8 px-4 text-center">
        <p className="font-body text-xs text-ink-light">
          © {new Date().getFullYear()} BLG Creations · All rights reserved · Made with love
        </p>
      </footer>
    </>
  );
}
