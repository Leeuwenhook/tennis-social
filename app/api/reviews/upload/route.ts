import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

import { IMAGE_TYPES, REVIEW_LIMITS, reviewMediaPrefix, VIDEO_TYPES } from '@/lib/review-rules';
import { database } from '@/lib/server/database';
import { loadReviewContext, reviewMediaEnabled, reviewsEnabled, reviewVideoEnabled } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Upload tokens a booking may request per day; the submit step enforces the real 5 + 1 limit. */
const DAILY_UPLOAD_TOKENS = 30;
const issued = new Map<string, number[]>();

function underRateLimit(bookingId: string) {
  const since = Date.now() - 86400000;
  const recent = (issued.get(bookingId) ?? []).filter((time) => time > since);
  if (recent.length >= DAILY_UPLOAD_TOKENS) return false;
  issued.set(bookingId, [...recent, Date.now()]);
  return true;
}

export async function POST(request: Request) {
  if (!reviewsEnabled() || !reviewMediaEnabled()) return Response.json({ error: 'uploads_disabled' }, { status: 404 });
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: 'upload_forbidden' }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload ?? '{}') as { t?: unknown; kind?: unknown };
        const kind = payload.kind === 'video' ? 'video' : 'image';
        if (kind === 'video' && !reviewVideoEnabled()) throw new Error('forbidden');
        const context = await loadReviewContext(database(), typeof payload.t === 'string' ? payload.t : '');
        if (!context?.canSubmit) throw new Error('forbidden');
        if (!pathname.startsWith(reviewMediaPrefix(context.bookingId))) throw new Error('forbidden');
        if (!underRateLimit(context.bookingId)) throw new Error('forbidden');
        return {
          allowedContentTypes: kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES,
          maximumSizeInBytes: kind === 'video' ? REVIEW_LIMITS.videoBytes : REVIEW_LIMITS.imageBytes,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: 'upload_forbidden' }, { status: 400 });
  }
}
