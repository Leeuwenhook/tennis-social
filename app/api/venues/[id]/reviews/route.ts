import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { serializePublicReview, type ReviewMediaRow, type ReviewRow } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_LIMIT = 12;

/** Approved reviews for a venue, newest first, paged by an opaque "created_at|id" cursor. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || 6));
  const [cursorCreated = null, cursorId = null] = params.get('cursor')?.split('|') ?? [];
  try {
    const db = database();
    const rows = (await db`
      SELECT * FROM session_reviews
      WHERE venue_id = ${id} AND status = 'approved' AND consent_public
        AND (${cursorCreated}::text IS NULL OR (created_at, id) < (${cursorCreated}::text, ${cursorId}::text))
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `) as ReviewRow[];
    const page = rows.slice(0, limit);
    const media = page.length
      ? ((await db`
          SELECT * FROM review_media
          WHERE review_id = ANY(${page.map((row) => row.id)}) AND status = 'approved'
          ORDER BY sort_order
        `) as ReviewMediaRow[])
      : [];
    const last = page[page.length - 1];
    return Response.json({
      reviews: page.map((row) => serializePublicReview(row, media.filter((item) => item.review_id === row.id))),
      nextCursor: rows.length > limit && last ? `${last.created_at}|${last.id}` : null,
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ reviews: [], nextCursor: null });
    console.error('Unable to load venue reviews');
    return Response.json({ error: 'reviews_unavailable' }, { status: 503 });
  }
}
