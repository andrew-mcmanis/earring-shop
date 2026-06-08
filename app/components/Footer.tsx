import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-cream-dark py-8 px-4 text-center">
      <p className="font-body text-xs text-ink-light">
        © {new Date().getFullYear()} BLG Creations · All rights reserved · Made with love
      </p>
      <Link
        href="/admin/login"
        className="inline-block mt-2 font-body text-xs text-ink-light/70 hover:text-kraft underline underline-offset-2 transition-colors duration-150"
      >
        Sign in
      </Link>
    </footer>
  );
}
