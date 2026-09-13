import { database, ensureSeeded, serializeBooking, type BookingRow } from '@/lib/server/database';
import { retrieveCheckoutSession } from '@/lib/server/stripe';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = database();
  await ensureSeeded(db);
  let booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<BookingRow>();
  if (!booking) return Response.json({ error: 'booking_not_found' }, { status: 404 });

  const checkoutSessionId = new URL(request.url).searchParams.get('checkout_session_id');
  if (
    booking.status === 'pending_payment' && checkoutSessionId &&
    checkoutSessionId === booking.stripe_checkout_session_id
  ) {
    try {
      const checkout = await retrieveCheckoutSession(checkoutSessionId);
      if (checkout.payment_status === 'paid' || checkout.payment_status === 'no_payment_required') {
        await db.prepare(`
          UPDATE bookings
          SET status = 'confirmed', stripe_payment_intent_id = ?, updated_at = ?
          WHERE id = ? AND status = 'pending_payment'
        `).bind(checkout.payment_intent, new Date().toISOString(), booking.id).run();
        booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<BookingRow>();
      }
    } catch (error) {
      console.error('Unable to reconcile checkout return', error);
    }
  }

  if (!booking) return Response.json({ error: 'booking_not_found' }, { status: 404 });
  return Response.json({ booking: serializeBooking(booking) });
}
