import { recordAdminAction } from '@/lib/server/audit-log';
import { requireAdmin } from '@/lib/server/admin-auth';
import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { deleteReviewCompletely } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'hidden'];
const MEDIA_STATUSES = ['pending', 'approved', 'rejected'];

function failure(error: unknown) {
  if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
  console.error('Unable to moderate review');
  return Response.json({ error: 'reviews_unavailable' }, { status: 503 });
}

/**
 * Moderates a review: { status, moderationNote?, mediaStatus?: { [mediaId]: status } }.
 * Approving a review approves its still-pending media; rejecting it rejects all of them.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const input = (await request.json().catch(() => null)) as {
    status?: unknown;
    moderationNote?: unknown;
    mediaStatus?: unknown;
  } | null;
  const status = typeof input?.status === 'string' && REVIEW_STATUSES.includes(input.status) ? input.status : null;
  if (!status) return Response.json({ error: 'invalid_status' }, { status: 400 });
  const note = typeof input?.moderationNote === 'string' ? input.moderationNote.slice(0, 500) : null;
  const mediaStatus = input?.mediaStatus && typeof input.mediaStatus === 'object' ? (input.mediaStatus as Record<string, unknown>) : {};
  try {
    const db = database();
    const now = new Date().toISOString();
    const rows = (await db`
      UPDATE session_reviews
      SET status = ${status}, moderation_note = COALESCE(${note}::text, moderation_note), moderated_at = ${now}, updated_at = ${now}
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;
    if (!rows[0]) return Response.json({ error: 'not_found' }, { status: 404 });
    if (status === 'approved') {
      await db`UPDATE review_media SET status = 'approved', updated_at = ${now} WHERE review_id = ${id} AND status = 'pending'`;
    } else if (status === 'rejected') {
      await db`UPDATE review_media SET status = 'rejected', updated_at = ${now} WHERE review_id = ${id}`;
    }
    for (const [mediaId, value] of Object.entries(mediaStatus)) {
      if (typeof value !== 'string' || !MEDIA_STATUSES.includes(value)) continue;
      await db`UPDATE review_media SET status = ${value}, updated_at = ${now} WHERE id = ${mediaId} AND review_id = ${id}`;
    }
    await recordAdminAction(db, request, {
      action: 'review.moderate', targetType: 'review', targetId: id,
      summary: `→ ${status}${Object.keys(mediaStatus).length ? ` (${Object.keys(mediaStatus).length} file)` : ''}`,
      after: { status, mediaStatus },
    });
    return Response.json({ review: { id, status } });
  } catch (error) {
    return failure(error);
  }
}

/** Hard delete (row and files), for erasure requests that arrive by email. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  try {
    const db = database();
    await deleteReviewCompletely(db, id);
    await recordAdminAction(db, request, { action: 'review.delete', targetType: 'review', targetId: id, summary: 'Deleted review and files' });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
