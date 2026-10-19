import { cancelBooking } from '@/lib/server/admin-cancel-booking';
import { database, DatabaseNotConfiguredError, serializeBooking } from '@/lib/server/database';
import { requireAdmin } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  let input: { status?: unknown; refund?: unknown };
  try {
    input = await request.json() as { status?: unknown; refund?: unknown };
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (input.status !== 'cancelled') return Response.json({ error: 'invalid_status' }, { status: 400 });
  try {
    const result = await cancelBooking(database(), id, input.refund === true);
    if ('booking' in result) return Response.json({ booking: serializeBooking(result.booking) });
    if (result.status === 'not_found') return Response.json({ error: 'booking_not_found' }, { status: 404 });
    if (result.status === 'refund_failed') return Response.json({ error: 'refund_failed' }, { status: 502 });
    return Response.json({ error: 'booking_already_processed' }, { status: 409 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to cancel booking', error);
    return Response.json({ error: 'booking_unavailable' }, { status: 503 });
  }
}
