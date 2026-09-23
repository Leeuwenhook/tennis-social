import {
  database,
  DatabaseNotConfiguredError,
  releaseBooking,
} from '@/lib/server/database';
import { sendConfirmedBookingEmail } from '@/lib/server/booking-email';
import { verifyStripeWebhook } from '@/lib/server/stripe';

type StripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: {
      id?: string;
      payment_status?: string;
      payment_intent?: string | null;
      refunded?: boolean;
      metadata?: Record<string, string>;
    };
  };
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  if (!event.id || !event.type || !event.data?.object?.id) {
    return Response.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const db = database();
    const now = new Date().toISOString();
    const eventRows = await db`
      INSERT INTO webhook_events (id, event_type, processed_at)
      VALUES (${event.id}, ${event.type}, ${now})
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    ` as Array<{ id: string }>;
    if (!eventRows[0]) return Response.json({ received: true });

    const object = event.data.object;
    const bookingId = object.metadata?.booking_id;
    try {
      if (bookingId && ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
        if (object.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded') {
          await db`
            UPDATE bookings
            SET status = 'confirmed', stripe_payment_intent_id = ${object.payment_intent ?? null}, updated_at = ${now}
            WHERE id = ${bookingId}
              AND stripe_checkout_session_id = ${object.id}
              AND status = 'pending_payment'
          `;
          // The email is also attempted when the booking was already confirmed,
          // so a delayed webhook or a second successful payment event can
          // recover an earlier delivery failure.
          await sendConfirmedBookingEmail(db, bookingId);
        }
      } else if (bookingId && event.type === 'checkout.session.expired') {
        await releaseBooking(db, bookingId, 'expired');
      } else if (bookingId && event.type === 'checkout.session.async_payment_failed') {
        await releaseBooking(db, bookingId, 'payment_failed');
      } else if (event.type === 'charge.refunded' && object.refunded && object.payment_intent) {
        // A refund of a confirmed booking releases its places. A previously
        // cancelled booking has already released them and is only relabelled.
        await db`
          WITH target AS (
            SELECT id, session_id, participant_count, status
            FROM bookings
            WHERE stripe_payment_intent_id = ${object.payment_intent}
              AND status IN ('confirmed', 'cancelled')
          ), updated AS (
            UPDATE bookings AS bookings
            SET status = 'refunded', updated_at = ${now}
            FROM target
            WHERE bookings.id = target.id
            RETURNING bookings.id
          )
          UPDATE sessions AS sessions
          SET booked_spots = GREATEST(0, sessions.booked_spots - target.participant_count),
              updated_at = ${now}
          FROM target
          JOIN updated ON updated.id = target.id
          WHERE target.status = 'confirmed' AND sessions.id = target.session_id
        `;
      }
    } catch (error) {
      // Let Stripe retry an event whose database transition failed.
      await db`DELETE FROM webhook_events WHERE id = ${event.id}`;
      throw error;
    }
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to process Stripe webhook', error);
    return Response.json({ error: 'webhook_unavailable' }, { status: 503 });
  }
}
