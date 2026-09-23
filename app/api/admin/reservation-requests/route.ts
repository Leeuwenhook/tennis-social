import { requireAdmin } from '@/lib/server/admin-auth';
import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeReservationRequest,
  type ReservationRequestRow,
} from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = database();
    await ensureSeeded(db);
    const rows = await db`
      SELECT * FROM reservation_requests
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
               preferred_date, start_time, created_at DESC
    ` as ReservationRequestRow[];
    return Response.json({ requests: rows.map(serializeReservationRequest) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to load reservation requests', error);
    return Response.json({ error: 'requests_unavailable' }, { status: 503 });
  }
}
