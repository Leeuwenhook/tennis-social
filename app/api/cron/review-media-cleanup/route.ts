import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { cleanupReviewMedia } from '@/lib/server/review-media-cleanup';
import { reviewMediaEnabled } from '@/lib/server/reviews';
import { getRuntimeEnv } from '@/lib/server/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = getRuntimeEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: 'cron_not_configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!reviewMediaEnabled()) return Response.json({ skipped: 'blob_not_configured' });
  try {
    return Response.json(await cleanupReviewMedia(database()));
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to clean up review media');
    return Response.json({ error: 'cleanup_unavailable' }, { status: 503 });
  }
}
