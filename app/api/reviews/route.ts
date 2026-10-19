import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { sendAdminReviewNotification } from '@/lib/server/email';
import {
  deleteReviewCompletely,
  loadReviewContext,
  reviewMediaEnabled,
  reviewsEnabled,
  reviewVideoEnabled,
  validateReviewSubmission,
  verifyUploadedMedia,
  type ReviewContext,
} from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unavailable(error: unknown, action: string) {
  if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
  if (error instanceof Error && error.message === 'token_secret_not_configured') return Response.json({ error: 'reviews_unavailable' }, { status: 503 });
  console.error(`Unable to ${action} review`);
  return Response.json({ error: 'reviews_unavailable' }, { status: 503 });
}

/** What the review page shows. Never includes the booking's email or phone. */
function publicContext(context: ReviewContext) {
  return {
    bookingId: context.bookingId,
    firstName: context.firstName,
    venueName: context.venueName,
    venueNameZh: context.venueNameZh,
    date: context.date,
    startTime: context.startTime,
    endTime: context.endTime,
    canSubmit: context.canSubmit,
    mediaEnabled: reviewMediaEnabled(),
    videoEnabled: reviewMediaEnabled() && reviewVideoEnabled(),
    review: context.review
      ? {
          displayName: context.review.display_name,
          rating: context.review.rating,
          body: context.review.body,
          status: context.review.status,
          media: context.review.media.map((item) => ({ kind: item.kind, url: item.blob_url })),
        }
      : null,
  };
}

export async function GET(request: Request) {
  if (!reviewsEnabled()) return Response.json({ error: 'reviews_disabled' }, { status: 404 });
  const token = new URL(request.url).searchParams.get('t') ?? '';
  try {
    const context = await loadReviewContext(database(), token);
    if (!context) return Response.json({ error: 'invalid_link' }, { status: 404 });
    return Response.json(publicContext(context));
  } catch (error) {
    return unavailable(error, 'load');
  }
}

export async function POST(request: Request) {
  if (!reviewsEnabled()) return Response.json({ error: 'reviews_disabled' }, { status: 404 });
  const text = await request.text();
  if (text.length > 20000) return Response.json({ error: 'invalid_review' }, { status: 413 });
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'invalid_review' }, { status: 400 });
  }
  try {
    const db = database();
    const context = await loadReviewContext(db, typeof input.t === 'string' ? input.t : '');
    if (!context) return Response.json({ error: 'invalid_link' }, { status: 404 });
    if (!context.canSubmit) return Response.json({ error: context.review ? 'already_reviewed' : 'review_closed' }, { status: 409 });
    const submission = validateReviewSubmission(input, context.bookingId, {
      mediaEnabled: reviewMediaEnabled(),
      videoEnabled: reviewVideoEnabled(),
    });
    if (!submission) return Response.json({ error: 'invalid_review' }, { status: 400 });
    const media = await verifyUploadedMedia(submission.media).catch(() => null);
    if (!media) return Response.json({ error: 'invalid_media' }, { status: 400 });

    const id = `review-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const inserted = (await db`
      INSERT INTO session_reviews (
        id, booking_id, session_id, venue_id, display_name, rating, body, language,
        consent_public, consent_media, consent_at, created_at, updated_at
      ) VALUES (
        ${id}, ${context.bookingId}, ${context.sessionId}, ${context.venueId}, ${submission.displayName},
        ${submission.rating}, ${submission.body}, ${submission.language}, true, ${submission.consentMedia}, ${now}, ${now}, ${now}
      )
      ON CONFLICT (booking_id) DO NOTHING
      RETURNING id
    `) as Array<{ id: string }>;
    if (!inserted[0]) return Response.json({ error: 'already_reviewed' }, { status: 409 });
    for (const [index, item] of media.entries()) {
      await db`
        INSERT INTO review_media (
          id, review_id, booking_id, kind, blob_url, blob_pathname, content_type, size_bytes,
          width, height, duration_seconds, status, sort_order, created_at, updated_at
        ) VALUES (
          ${`media-${crypto.randomUUID()}`}, ${id}, ${context.bookingId}, ${item.kind}, ${item.url}, ${item.pathname},
          ${item.contentType}, ${item.size}, ${item.width}, ${item.height}, ${item.durationSeconds}, 'pending', ${index}, ${now}, ${now}
        )
        ON CONFLICT (blob_pathname) DO UPDATE
        SET review_id = EXCLUDED.review_id, status = 'pending', sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at
        WHERE review_media.booking_id = EXCLUDED.booking_id AND review_media.review_id IS NULL
      `;
    }
    await sendAdminReviewNotification({
      id, Venue: context.venueName, Session: `${context.date} ${context.startTime}–${context.endTime}`,
      Name: submission.displayName, Rating: submission.rating ?? '-', Review: submission.body,
      Photos: media.filter((item) => item.kind === 'image').length, Videos: media.filter((item) => item.kind === 'video').length,
    });
    return Response.json({ review: { id, status: 'pending' } }, { status: 201 });
  } catch (error) {
    return unavailable(error, 'submit');
  }
}

/** Self-service deletion while the emailed link is valid (UK GDPR right to erasure). */
export async function DELETE(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  try {
    const db = database();
    const context = await loadReviewContext(db, token);
    if (!context) return Response.json({ error: 'invalid_link' }, { status: 404 });
    if (context.review) await deleteReviewCompletely(db, context.review.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return unavailable(error, 'delete');
  }
}
