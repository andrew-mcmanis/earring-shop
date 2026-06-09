'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '../../lib/supabase-browser';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-heading text-5xl font-bold text-ink">BLG Creations</h1>
          <p className="font-body text-sm text-ink-light mt-1">Shop admin — please sign in</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-cream-dark rounded-lg p-6 flex flex-col gap-4"
        >
          {error && (
            <p
              role="alert"
              className="font-body text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="font-body text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-body text-sm text-ink bg-white border border-kraft-light rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="font-body text-sm font-medium text-ink">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full font-body text-sm text-ink bg-white border border-kraft-light rounded pl-3 pr-11 py-2.5 focus:outline-none focus:ring-2 focus:ring-kraft focus:border-kraft"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-ink-light hover:text-kraft transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft rounded-r cursor-pointer"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243-4.243-4.243" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer bg-kraft text-cream font-body text-sm font-semibold px-5 py-3 rounded hover:bg-kraft-dark transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-kraft focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center mt-4">
          <Link href="/" className="font-body text-xs text-ink-light hover:text-kraft underline underline-offset-2">
            ← Back to shop
          </Link>
        </p>
      </div>
    </main>
  );
}
