import { sendDueReviewInvites } from '../../lib/review-invites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Manual trigger / test endpoint for the delayed review invites. The daily run
// is folded into /api/keep-alive (the Vercel plan allows a single cron), but
// this endpoint stays available to send any due invites on demand.
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const result = await sendDueReviewInvites();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
