import { database, ensureSeeded, expireStaleReservations, serializeSession, type SessionRow } from '@/lib/server/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = database();
    await ensureSeeded(db);
    await expireStaleReservations(db);
    const result = await db.prepare(`
      SELECT id, venue_id, date, start_time, end_time, price_pence, capacity,
             booked_spots, status, description, description_zh
      FROM sessions
      ORDER BY date, start_time
    `).all<SessionRow>();
    return Response.json({ sessions: result.results.map(serializeSession) });
  } catch (error) {
    console.error('Unable to load sessions', error);
    return Response.json({ error: 'sessions_unavailable' }, { status: 503 });
  }
}
