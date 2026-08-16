import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

// Shared chrome for the static content pages under app/(content). Renders the
// Header, a centered reading column, and the Footer once; each page supplies
// only its own body. The home page is outside this group and unaffected.
// CartProvider (root layout) uses a Context.Provider with no DOM element, so
// Header/main/Footer are direct flex children of <body> (flex flex-col) —
// `flex-1` on <main> keeps the footer pinned to the bottom on short pages.
export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 reveal">
        {children}
      </main>
      <Footer />
    </>
  );
}
