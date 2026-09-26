import {
  database,
  ensureSeeded,
  expireStaleReservations,
  serializeSession,
  type SessionRow,
} from '@/lib/server/database';
import { GAME_FORMATS, type GameFormat } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

type BookingPreference = { level: string; format: GameFormat };

function parseParticipants(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((participant): participant is string => typeof participant === 'string' && participant.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const db = database();
    await ensureSeeded(db);
    await expireStaleReservations(db);
    const rows = await db`
      SELECT id, venue_id, date, start_time, end_time, price_pence, capacity,
             booked_spots, formats_json, status, description, description_zh
      FROM sessions
      ORDER BY date, start_time
    ` as SessionRow[];
    const bookingRows = await db`
      SELECT session_id, format, participants_json
      FROM bookings
      WHERE status = 'confirmed'
    ` as Array<{ session_id: string; format: string; participants_json: string }>;
    const preferencesBySession = new Map<string, BookingPreference[]>();
    for (const booking of bookingRows) {
      const format = GAME_FORMATS.includes(booking.format as GameFormat)
        ? booking.format as GameFormat
        : 'singles';
      const preferences = preferencesBySession.get(booking.session_id) ?? [];
      preferences.push(...parseParticipants(booking.participants_json).map((level) => ({ level, format })));
      preferencesBySession.set(booking.session_id, preferences);
    }
    return Response.json({
      sessions: rows.map((row) => ({
        ...serializeSession(row),
        bookingPreferences: preferencesBySession.get(row.id) ?? [],
      })),
    });
  } catch (error) {
    console.error('Unable to load sessions', error);
    return Response.json({ error: 'sessions_unavailable' }, { status: 503 });
  }
}
