import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  expireStaleReservations,
  serializeBooking,
  type BookingRow,
} from '@/lib/server/database';
import { requireAdmin } from '@/lib/server/admin-auth';
import { searchAdminBookings } from '@/lib/server/admin-bookings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = database();
    await ensureSeeded(db);
    await expireStaleReservations(db);
    const params = new URL(request.url).searchParams;
    if (params.has('scope')) return Response.json(await searchAdminBookings(db, params));
    const rows = await db`
      SELECT *
      FROM bookings
      ORDER BY created_at DESC, id DESC
    ` as BookingRow[];
    return Response.json({ bookings: rows.map(serializeBooking) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to load admin bookings', error);
    return Response.json({ error: 'bookings_unavailable' }, { status: 503 });
  }
}
