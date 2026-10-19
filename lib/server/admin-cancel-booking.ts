import { serializeVenue, type BookingRow, type Database, type VenueRow } from './database';
import { sendAdminCancellationEmail, type EmailSendResult, type AdminCancellationEmailInput } from './email';
import { createRefund } from './stripe';

export type CancelOutcome =
  | { status: 'not_found' | 'already_processed' | 'refund_failed' }
  | { status: 'cancelled' | 'refunded'; booking: BookingRow };

type Deps = {
  refund: typeof createRefund;
  notify: (input: AdminCancellationEmailInput) => Promise<EmailSendResult>;
};

const defaultDeps: Deps = { refund: createRefund, notify: sendAdminCancellationEmail };

/**
 * Cancels a confirmed booking and, when asked and the booking was paid,
 * refunds it in full first. A failed refund leaves the booking untouched so
 * the admin can retry. The player is emailed either way.
 */
export async function cancelBooking(db: Database, bookingId: string, refund: boolean, deps: Deps = defaultDeps): Promise<CancelOutcome> {
  const rows = (await db`SELECT * FROM bookings WHERE id = ${bookingId}`) as BookingRow[];
  const booking = rows[0];
  if (!booking) return { status: 'not_found' };
  if (booking.status !== 'confirmed') return { status: 'already_processed' };

  const paid = booking.total_pence > 0 && Boolean(booking.stripe_payment_intent_id);
  const refunding = refund && paid;
  if (refunding) {
    try {
      await deps.refund({ paymentIntentId: booking.stripe_payment_intent_id!, bookingId, reason: 'admin_cancel' });
    } catch {
      console.error('Admin refund failed', bookingId);
      return { status: 'refund_failed' };
    }
  }

  const now = new Date().toISOString();
  const status = refunding ? 'refunded' : 'cancelled';
  const updated = (await db`
    WITH cancelled AS (
      UPDATE bookings
      SET status = ${status}, updated_at = ${now}
      WHERE id = ${bookingId} AND status = 'confirmed'
      RETURNING *
    ), released AS (
      UPDATE sessions AS sessions
      SET booked_spots = GREATEST(0, sessions.booked_spots - cancelled.participant_count), updated_at = ${now}
      FROM cancelled
      WHERE sessions.id = cancelled.session_id
      RETURNING sessions.id
    )
    SELECT * FROM cancelled
  `) as BookingRow[];
  // The charge.refunded webhook can win the race and relabel the booking first.
  if (!updated[0]) return refunding ? { status: 'refunded', booking } : { status: 'already_processed' };

  try {
    const details = (await db`
      SELECT sessions.date, sessions.start_time, sessions.end_time, venues.*
      FROM sessions JOIN venues ON venues.id = sessions.venue_id
      WHERE sessions.id = ${booking.session_id}
    `) as Array<VenueRow & { date: string; start_time: string; end_time: string }>;
    if (details[0]) {
      await deps.notify({
        booking: updated[0],
        session: { date: details[0].date, start_time: details[0].start_time, end_time: details[0].end_time },
        venue: serializeVenue(details[0]),
        refunded: refunding,
      });
    }
  } catch {
    console.error('Cancellation email failed', bookingId);
  }
  return { status, booking: updated[0] };
}
