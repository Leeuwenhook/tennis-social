import { database, type BookingRow } from '@/lib/server/database';
import { verifyStripeWebhook } from '@/lib/server/stripe';

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      payment_status?: string;
      payment_intent?: string | null;
      refunded?: boolean;
      metadata?: Record<string, string>;
    };
  };
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const payload = await request.text();
  if (!await verifyStripeWebhook(payload, request.headers.get('stripe-signature'))) {
    return Response.json({ error: 'invalid_signature' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const db = database();
  const alreadyProcessed = await db.prepare('SELECT id FROM webhook_events WHERE id = ?').bind(event.id).first();
  if (alreadyProcessed) return Response.json({ received: true });

  const object = event.data.object;
  const bookingId = object.metadata?.booking_id;
  const now = new Date().toISOString();

  if (bookingId && ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    if (object.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded') {
      await db.prepare(`
        UPDATE bookings
        SET status = 'confirmed', stripe_payment_intent_id = ?, updated_at = ?
        WHERE id = ? AND stripe_checkout_session_id = ? AND status = 'pending_payment'
      `).bind(object.payment_intent ?? null, now, bookingId, object.id).run();
    }
  } else if (bookingId && event.type === 'checkout.session.expired') {
    await db.prepare(`
      UPDATE bookings SET status = 'expired', updated_at = ?
      WHERE id = ? AND stripe_checkout_session_id = ? AND status = 'pending_payment'
    `).bind(now, bookingId, object.id).run();
  } else if (bookingId && event.type === 'checkout.session.async_payment_failed') {
    await db.prepare(`
      UPDATE bookings SET status = 'payment_failed', updated_at = ?
      WHERE id = ? AND stripe_checkout_session_id = ? AND status = 'pending_payment'
    `).bind(now, bookingId, object.id).run();
  } else if (event.type === 'charge.refunded' && object.refunded && object.payment_intent) {
    const booking = await db.prepare(`
      SELECT * FROM bookings WHERE stripe_payment_intent_id = ?
    `).bind(object.payment_intent).first<BookingRow>();
    if (booking) {
      await db.prepare(`
        UPDATE bookings SET status = 'refunded', updated_at = ?
        WHERE id = ? AND status IN ('confirmed', 'cancelled')
      `).bind(now, booking.id).run();
    }
  }

  await db.prepare(`
    INSERT OR IGNORE INTO webhook_events (id, event_type, processed_at) VALUES (?, ?, ?)
  `).bind(event.id, event.type, now).run();
  return Response.json({ received: true });
}
