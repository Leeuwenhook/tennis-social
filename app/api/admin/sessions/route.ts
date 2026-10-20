import { londonDate } from '@/lib/server/london-time';
import { auditedMutation } from '@/lib/server/audit-log';
import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  expireStaleReservations,
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
    const venueRows = await db`SELECT id, name, name_zh FROM venues` as Array<{ id: string; name: string; name_zh: string }>;
    const session = input ? validateSessionInput(input, venueRows.map((venue) => venue.id)) : null;
    if (!session) return Response.json({ error: 'invalid_session' }, { status: 400 });
    const now = new Date().toISOString();
    const id = `session-${crypto.randomUUID()}`;
    const rows = await auditedMutation(db, request, { action: 'session.create', targetType: 'session', targetId: id, summary: `${session.date} ${session.startTime}` })`
      INSERT INTO sessions (
        id, venue_id, date, start_time, end_time, price_pence, capacity,
        booked_spots, formats_json, seeking_levels_json, status, description, description_zh, created_at, updated_at
      ) VALUES (
        ${id}, ${session.venueId}, ${session.date}, ${session.startTime}, ${session.endTime},
        ${session.pricePence}, ${session.capacity}, 0, ${JSON.stringify(session.formats)}, ${JSON.stringify(session.seekingLevels)}, ${session.status},
        ${''}, ${''}, ${now}, ${now}
      )
      RETURNING id, venue_id, date, start_time, end_time, price_pence, capacity,
                booked_spots, marked_full, formats_json, seeking_levels_json, status
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

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const db = database();
    await ensureSeeded(db);
    await expireStaleReservations(db);
    // Optional lower bound so the admin does not load every past session.
    const fromParam = new URL(request.url).searchParams.get('from') ?? '';
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam :
      new URL(request.url).searchParams.get('all') === '1' ? null : londonDate(new Date(Date.now() - 30 * 86400000));
    const rows = await db`
      SELECT id, venue_id, date, start_time, end_time, price_pence, capacity,
             booked_spots, marked_full, formats_json, seeking_levels_json, status
      FROM sessions
      WHERE ${from}::text IS NULL OR date >= ${from}
      ORDER BY date, start_time
    ` as SessionRow[];
    return Response.json({ sessions: rows.map(serializeSession) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to load admin sessions', error);
    return Response.json({ error: 'sessions_unavailable' }, { status: 503 });
  }
}
