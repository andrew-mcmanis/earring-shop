import { isSupabaseConfigured, createReadClient } from '../../lib/supabase';

// Keep the Supabase project active. Supabase's free tier pauses a project after
// ~7 days without activity, which would knock the live shop back to placeholder
// sample data and break the admin. The storefront pages are statically cached,
// so ordinary visits don't reliably hit the database — this route always runs a
// tiny query. Triggered daily by a Vercel Cron (see vercel.json).
//
// Route Handlers aren't cached by default, and this one reads headers + the DB,
// so it always runs at request time.
export async function GET(request: Request): Promise<Response> {
  // If a CRON_SECRET is set, require it. Vercel sends it automatically as
  // `Authorization: Bearer <CRON_SECRET>` on cron invocations, so setting that
  // env var locks the endpoint down to the scheduler. Optional — the query below
  // is harmless either way.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return Response.json({ ok: true, pinged: false, reason: 'supabase not configured' });
  }

  const supabase = createReadClient();
  const { error } = await supabase.from('products').select('id').limit(1);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, pinged: true, at: new Date().toISOString() });
}
