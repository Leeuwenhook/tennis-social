import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeReservationRequest,
  type ReservationRequestRow,
} from '@/lib/server/database';
import {
  validateReservationRequest,
  type ReservationRequestInput,
} from '@/lib/server/reservation-request-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let input: ReservationRequestInput;
  try {
    input = await request.json() as ReservationRequestInput;
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const db = database();
    await ensureSeeded(db);
    const venueRows = await db`SELECT id FROM venues` as { id: string }[];
    const value = validateReservationRequest(input, venueRows.map((venue) => venue.id));
    if (!value) return Response.json({ error: 'invalid_request' }, { status: 400 });

    const id = `request-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const rows = await db`
      INSERT INTO reservation_requests (
        id, venue_id, preferred_date, start_time, end_time, contact_name,
        email, phone, message, status, created_at, updated_at
      ) VALUES (
        ${id}, ${value.venueId}, ${value.preferredDate}, ${value.startTime}, ${value.endTime},
        ${value.contactName}, ${value.email}, ${value.phone}, ${value.message}, 'pending', ${now}, ${now}
      )
      RETURNING *
    ` as ReservationRequestRow[];
    return Response.json({ request: serializeReservationRequest(rows[0]) }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to create reservation request', error);
    return Response.json({ error: 'request_unavailable' }, { status: 503 });
  }
}
