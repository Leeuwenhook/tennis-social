import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeSession,
  type SessionRow,
} from '@/lib/server/database';
import { validateSessionInput, type SessionInput } from '@/lib/server/admin-validation';
import { requireAdmin } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function parseBody(request: Request) {
  try {
    return await request.json() as SessionInput;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const input = await parseBody(request);

  try {
    const db = database();
    await ensureSeeded(db);
    const venueRows = await db`SELECT id FROM venues` as Array<{ id: string }>;
    const session = input ? validateSessionInput(input, venueRows.map((venue) => venue.id)) : null;
    if (!session) return Response.json({ error: 'invalid_session' }, { status: 400 });
    const now = new Date().toISOString();
    const id = `session-${crypto.randomUUID()}`;
    const rows = await db`
      INSERT INTO sessions (
        id, venue_id, date, start_time, end_time, price_pence, capacity,
        booked_spots, formats_json, status, description, description_zh, created_at, updated_at
      ) VALUES (
        ${id}, ${session.venueId}, ${session.date}, ${session.startTime}, ${session.endTime},
        ${session.pricePence}, ${session.capacity}, 0, ${JSON.stringify(session.formats)}, ${session.status},
        ${session.description}, ${session.descriptionZh}, ${now}, ${now}
      )
      RETURNING id, venue_id, date, start_time, end_time, price_pence, capacity,
                booked_spots, formats_json, status, description, description_zh
    ` as SessionRow[];
    return Response.json({ session: serializeSession(rows[0]) }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to create session', error);
    return Response.json({ error: 'session_unavailable' }, { status: 503 });
  }
}
