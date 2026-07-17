import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase-server';

/**
 * Resolve the signed-in admin's Supabase client, or throw. Every admin server
 * action calls this before touching the database — the shared implementation
 * keeps the auth check identical across admin sections. (The proxy matcher on
 * /admin/:path* is the user-facing gate; an unauthenticated hit here is
 * programmatic, so a plain error is the right response. Form actions that
 * prefer a login redirect wrap this in a try/catch.)
 */
export async function requireUser(): Promise<SupabaseClient> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authorised.');
  return supabase;
}
