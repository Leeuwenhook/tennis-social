import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  expireStaleReservations,
  awardLoyaltyCoupons,
  confirmBooking,
  serializeBooking,
  type BookingRow,
} from '@/lib/server/database';
import {
  sendConfirmedBookingEmail,
  type BookingEmailDelivery,
} from '@/lib/server/booking-email';
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
          const confirmed = await confirmBooking(db, booking.id, checkoutSessionId, checkout.payment_intent);
          if (confirmed?.user_id) {
            try {
              await awardLoyaltyCoupons(db, confirmed.user_id);
            } catch (error) {
              console.error('Unable to award loyalty coupon', error);
            }
          }
          rows = await db`SELECT * FROM bookings WHERE id = ${id}` as BookingRow[];
        }
      } catch (error) {
        console.error('Unable to reconcile checkout return', error);
      }
    }

    const currentBooking = rows[0];
    if (!currentBooking) return Response.json({ error: 'booking_not_found' }, { status: 404 });
    let confirmationEmailStatus: BookingEmailDelivery['status'] = 'not_applicable';
    if (currentBooking.status === 'confirmed') {
      try {
        confirmationEmailStatus = (await sendConfirmedBookingEmail(db, currentBooking.id)).status;
      } catch (error) {
        // Payment confirmation should remain visible even if the email
        // provider is temporarily unavailable. A later checkout return or
        // webhook retry can try the delivery again.
        console.error('Unable to send booking confirmation email', error);
        confirmationEmailStatus = 'failed';
      }
    }
    return Response.json({ booking: serializeBooking(currentBooking), confirmationEmailStatus });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to load booking', error);
    return Response.json({ error: 'booking_unavailable' }, { status: 503 });
  }
}
