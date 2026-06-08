import Link from 'next/link';
import { signOut } from './actions';

export function AdminHeader() {
  return (
    <header className="bg-white border-b border-cream-dark">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link href="/admin" className="group">
          <span className="font-heading text-3xl font-bold text-ink leading-none group-hover:text-kraft transition-colors duration-150">
            BLG Creations
          </span>
          <span className="block font-body text-xs text-ink-light mt-0.5">Shop admin</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-body text-sm text-ink hover:text-kraft transition-colors duration-150"
          >
            View shop
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="cursor-pointer font-body text-sm font-medium text-cream bg-kraft px-3 py-1.5 rounded hover:bg-kraft-dark transition-colors duration-150"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
