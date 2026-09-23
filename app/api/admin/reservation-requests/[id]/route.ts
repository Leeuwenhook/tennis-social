import { requireAdmin } from '@/lib/server/admin-auth';
import {
  database,
  DatabaseNotConfiguredError,
  serializeReservationRequest,
  type ReservationRequestRow,
} from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let body: { status?: unknown };
  try {
    body = await request.json() as { status?: unknown };
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (body.status !== 'pending' && body.status !== 'reviewing' && body.status !== 'completed') {
    return Response.json({ error: 'invalid_status' }, { status: 400 });
  }

  try {
    const db = database();
    const { id } = await context.params;
    const rows = await db`
      UPDATE reservation_requests
      SET status = ${body.status}, updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    ` as ReservationRequestRow[];
    if (!rows[0]) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ request: serializeReservationRequest(rows[0]) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to update reservation request', error);
    return Response.json({ error: 'request_unavailable' }, { status: 503 });
  }
}
