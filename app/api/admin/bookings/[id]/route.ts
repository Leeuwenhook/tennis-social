import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeBooking,
  type BookingRow,
} from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let input: { status?: unknown };
  try {
    input = await request.json() as { status?: unknown };
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (input.status !== 'cancelled') return Response.json({ error: 'invalid_status' }, { status: 400 });

  try {
    const db = database();
    await ensureSeeded(db);
    const now = new Date().toISOString();
    const rows = await db`
      WITH cancelled AS (
        UPDATE bookings
        SET status = 'cancelled', updated_at = ${now}
        WHERE id = ${id} AND status = 'confirmed'
        RETURNING id, session_id, participant_count
      ), released AS (
        UPDATE sessions AS sessions
        SET booked_spots = GREATEST(0, sessions.booked_spots - cancelled.participant_count),
            updated_at = ${now}
        FROM cancelled
        WHERE sessions.id = cancelled.session_id
        RETURNING sessions.id
      )
      SELECT bookings.*
      FROM bookings
      JOIN cancelled ON cancelled.id = bookings.id
    ` as BookingRow[];
    if (!rows[0]) {
      const existing = await db`SELECT status FROM bookings WHERE id = ${id}` as Array<{ status: string }>;
      if (!existing[0]) return Response.json({ error: 'booking_not_found' }, { status: 404 });
      return Response.json({ error: 'booking_already_processed' }, { status: 409 });
    }
    return Response.json({ booking: serializeBooking(rows[0]) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to cancel booking', error);
    return Response.json({ error: 'booking_unavailable' }, { status: 503 });
  }
}
