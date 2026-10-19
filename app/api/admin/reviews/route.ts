import { requireAdmin } from '@/lib/server/admin-auth';
import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import type { ReviewMediaRow, ReviewRow } from '@/lib/server/reviews';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES = ['pending', 'approved', 'rejected', 'hidden'];

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const statusParam = new URL(request.url).searchParams.get('status') ?? 'pending';
  const status = STATUSES.includes(statusParam) ? statusParam : 'pending';
  try {
    const db = database();
    const rows = (await db`
      SELECT session_reviews.*, bookings.contact_name, bookings.email, venues.name AS venue_name,
             sessions.date, sessions.start_time, sessions.end_time
      FROM session_reviews
      JOIN bookings ON bookings.id = session_reviews.booking_id
      JOIN sessions ON sessions.id = session_reviews.session_id
      JOIN venues ON venues.id = session_reviews.venue_id
      WHERE session_reviews.status = ${status}
      ORDER BY session_reviews.created_at DESC
      LIMIT 100
    `) as Array<ReviewRow & { contact_name: string; email: string; venue_name: string; date: string; start_time: string; end_time: string }>;
    const media = rows.length
      ? ((await db`SELECT * FROM review_media WHERE review_id = ANY(${rows.map((row) => row.id)}) ORDER BY sort_order`) as ReviewMediaRow[])
      : [];
    const counts = (await db`SELECT status, COUNT(*)::integer AS count FROM session_reviews GROUP BY status`) as Array<{ status: string; count: number }>;
    return Response.json({
      counts: Object.fromEntries(counts.map((row) => [row.status, row.count])),
      reviews: rows.map((row) => ({
        id: row.id,
        status: row.status,
        displayName: row.display_name,
        rating: row.rating,
        body: row.body,
        language: row.language,
        consentMedia: row.consent_media,
        moderationNote: row.moderation_note,
        createdAt: row.created_at,
        contactName: row.contact_name,
        email: row.email,
        venueName: row.venue_name,
        session: `${row.date} ${row.start_time}–${row.end_time}`,
        media: media
          .filter((item) => item.review_id === row.id)
          .map((item) => ({ id: item.id, kind: item.kind, url: item.blob_url, status: item.status, sizeBytes: item.size_bytes, durationSeconds: item.duration_seconds })),
      })),
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to load reviews for moderation');
    return Response.json({ error: 'reviews_unavailable' }, { status: 503 });
  }
}
