import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  expireStaleReservations,
  serializeBooking,
  type BookingRow,
} from '@/lib/server/database';
import { retrieveCheckoutSession } from '@/lib/server/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const db = database();
    await ensureSeeded(db);
    await expireStaleReservations(db);
    let rows = await db`
      SELECT *
      FROM bookings
      WHERE id = ${id}
    ` as BookingRow[];
    const booking = rows[0];
    if (!booking) return Response.json({ error: 'booking_not_found' }, { status: 404 });

    const checkoutSessionId = new URL(request.url).searchParams.get('checkout_session_id');
    // A booking reference alone is not enough to read contact details. The
    // Stripe session id proves that this request came from the checkout return.
    if (!checkoutSessionId || checkoutSessionId !== booking.stripe_checkout_session_id) {
      return Response.json({ error: 'booking_not_found' }, { status: 404 });
    }

    if (booking.status === 'pending_payment') {
      try {
        const checkout = await retrieveCheckoutSession(checkoutSessionId);
        if (checkout.payment_status === 'paid' || checkout.payment_status === 'no_payment_required') {
          await db`
            UPDATE bookings
            SET status = 'confirmed', stripe_payment_intent_id = ${checkout.payment_intent}, updated_at = ${new Date().toISOString()}
            WHERE id = ${booking.id} AND stripe_checkout_session_id = ${checkoutSessionId} AND status = 'pending_payment'
          `;
          rows = await db`SELECT * FROM bookings WHERE id = ${id}` as BookingRow[];
        }
      } catch (error) {
        console.error('Unable to reconcile checkout return', error);
      }
    }

    const currentBooking = rows[0];
    if (!currentBooking) return Response.json({ error: 'booking_not_found' }, { status: 404 });
    return Response.json({ booking: serializeBooking(currentBooking) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to load booking', error);
    return Response.json({ error: 'booking_unavailable' }, { status: 503 });
  }
}
