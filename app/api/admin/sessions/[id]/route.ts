import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeSession,
  type SessionRow,
} from '@/lib/server/database';
import { validateSessionInput, type SessionInput } from '@/lib/server/admin-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function parseBody(request: Request) {
  try {
    return await request.json() as SessionInput;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const input = await parseBody(request);
  const session = input ? validateSessionInput(input) : null;
  if (!session) return Response.json({ error: 'invalid_session' }, { status: 400 });

  try {
    const db = database();
    await ensureSeeded(db);
    const existingRows = await db`
      SELECT id, venue_id, date, start_time, end_time, price_pence, capacity,
             booked_spots, formats_json, status, description, description_zh
      FROM sessions
      WHERE id = ${id}
    ` as SessionRow[];
    const existing = existingRows[0];
    if (!existing) return Response.json({ error: 'session_not_found' }, { status: 404 });

    const bookingRows = await db`
      SELECT COALESCE(SUM(participant_count), 0)::integer AS participant_count
      FROM bookings
      WHERE session_id = ${id} AND status = 'confirmed'
    ` as Array<{ participant_count: number }>;
    const activeBookingCount = bookingRows[0]?.participant_count ?? 0;
    const locked = activeBookingCount > 0 && (
      session.venueId !== existing.venue_id ||
      session.date !== existing.date ||
      session.startTime !== existing.start_time ||
      session.endTime !== existing.end_time ||
      session.pricePence !== existing.price_pence
    );
    if (locked) return Response.json({ error: 'locked_fields' }, { status: 409 });
    if (session.capacity < Math.max(activeBookingCount, existing.booked_spots)) {
      return Response.json({ error: 'capacity_too_low' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const rows = await db`
      UPDATE sessions
      SET venue_id = ${session.venueId}, date = ${session.date}, start_time = ${session.startTime},
          end_time = ${session.endTime}, price_pence = ${session.pricePence}, capacity = ${session.capacity},
          formats_json = ${JSON.stringify(session.formats)}, status = ${session.status}, description = ${session.description},
          description_zh = ${session.descriptionZh}, updated_at = ${now}
      WHERE id = ${id} AND booked_spots <= ${session.capacity}
      RETURNING id, venue_id, date, start_time, end_time, price_pence, capacity,
                booked_spots, formats_json, status, description, description_zh
    ` as SessionRow[];
    if (!rows[0]) return Response.json({ error: 'capacity_too_low' }, { status: 409 });
    return Response.json({ session: serializeSession(rows[0]) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to update session', error);
    return Response.json({ error: 'session_unavailable' }, { status: 503 });
  }
}
