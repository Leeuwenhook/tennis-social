import { randomUUID } from 'node:crypto';
import { serializeVenue, type BookingRow, type Database, type VenueRow } from './database';
import { sendAdminCancellationEmail, type EmailSendResult, type AdminCancellationEmailInput } from './email';
import { createRefund } from './stripe';

export type CancelOutcome =
  | { status: 'not_found' | 'already_processed' | 'refund_failed' }
  | { status: 'cancelled' | 'refunded'; booking: BookingRow; emailPending: boolean };

type Deps = {
  refund: typeof createRefund;
  notify: (input: AdminCancellationEmailInput) => Promise<EmailSendResult>;
};
const defaultDeps: Deps = { refund: createRefund, notify: sendAdminCancellationEmail };
type Command = { booking_id: string; refund: boolean; actor: string; completed_at: string | null };

/** A durable command fixes the refund choice before any external call. Retries resume it. */
export async function cancelBooking(db: Database, bookingId: string, refund: boolean, deps: Deps = defaultDeps, actor = 'unknown'): Promise<CancelOutcome> {
  const rows = (await db`SELECT * FROM bookings WHERE id = ${bookingId}`) as BookingRow[];
  let booking = rows[0];
  if (!booking) return { status: 'not_found' };
  // Only a confirmed booking can start a command; an existing command can be resumed
  // after a webhook, DB failure or lost response, including after cancellation.
  await db`
    INSERT INTO admin_booking_cancellations (booking_id, refund, actor)
    SELECT id, ${refund}, ${actor} FROM bookings WHERE id = ${bookingId} AND status = 'confirmed'
    ON CONFLICT (booking_id) DO NOTHING
  `;
  const commands = (await db`SELECT * FROM admin_booking_cancellations WHERE booking_id = ${bookingId}`) as Command[];
  const command = commands[0];
  if (!command) return { status: 'already_processed' };
  const refunding = command.refund && booking.total_pence > 0 && Boolean(booking.stripe_payment_intent_id);
  if (!command.completed_at) {
    if (refunding && booking.status !== 'refunded') {
      try {
        const result = await deps.refund({ paymentIntentId: booking.stripe_payment_intent_id!, bookingId, reason: 'admin_cancel' });
        // Stripe can return pending or failed with HTTP 200. Keep the booking until success.
        if (result.status !== 'succeeded') return { status: 'refund_failed' };
      } catch {
        console.error('Admin refund failed', bookingId);
        return { status: 'refund_failed' };
      }
    }
    const now = new Date().toISOString();
    const status = refunding ? 'refunded' : 'cancelled';
    await db`
      WITH command AS (
        UPDATE admin_booking_cancellations SET completed_at = ${now}
        WHERE booking_id = ${bookingId} AND completed_at IS NULL RETURNING actor
      ), target AS (
        SELECT * FROM bookings WHERE id = ${bookingId} AND EXISTS (SELECT 1 FROM command) FOR UPDATE
      ), updated AS (
        UPDATE bookings SET status = CASE WHEN target.status = 'refunded' THEN 'refunded' ELSE ${status} END, updated_at = ${now}
        FROM target WHERE bookings.id = target.id RETURNING bookings.*
      ), released AS (
        UPDATE sessions SET booked_spots = GREATEST(0, sessions.booked_spots - target.participant_count), updated_at = ${now}
        FROM target JOIN updated ON updated.id = target.id
        WHERE sessions.id = target.session_id AND target.status = 'confirmed' RETURNING sessions.id
      )
      INSERT INTO admin_audit_log (id, created_at, actor, action, target_type, target_id, summary, before_json, after_json)
      SELECT ${`audit-cancel-${bookingId}`}, ${now}, command.actor,
        CASE WHEN updated.status = 'refunded' THEN 'booking.refund' ELSE 'booking.cancel' END,
        'booking', ${bookingId}, ${booking.contact_name},
        ${JSON.stringify({ status: 'confirmed' })}, json_build_object('status', updated.status)::text
      FROM command CROSS JOIN updated
    `;
  }
  const current = (await db`SELECT * FROM bookings WHERE id = ${bookingId}`) as BookingRow[];
  booking = current[0];
  if (!booking || !['cancelled', 'refunded'].includes(booking.status)) return { status: 'already_processed' };
  const emailPending = !(await notifyCancellationOnce(db, booking, deps.notify));
  return { status: booking.status as 'cancelled' | 'refunded', booking, emailPending };
}

/** Claim ownership prevents concurrent sends; failure releases the claim for a later PATCH. */
export async function notifyCancellationOnce(db: Database, booking: BookingRow, notify: Deps['notify']) {
  const token = randomUUID();
  const stale = new Date(Date.now() - 10 * 60000).toISOString();
  const claimed = (await db`
    UPDATE admin_booking_cancellations SET email_status = 'sending', email_claim = ${token}, email_claimed_at = ${new Date().toISOString()}
    WHERE booking_id = ${booking.id} AND completed_at IS NOT NULL
      AND (email_status = 'pending' OR (email_status = 'sending' AND email_claimed_at < ${stale}))
    RETURNING booking_id
  `) as Array<{ booking_id: string }>;
  if (!claimed[0]) {
    const state = (await db`SELECT email_status FROM admin_booking_cancellations WHERE booking_id = ${booking.id}`) as Array<{ email_status: string }>;
    return state[0]?.email_status === 'sent';
  }
  try {
    const details = (await db`
      SELECT sessions.date, sessions.start_time, sessions.end_time, venues.*
      FROM sessions JOIN venues ON venues.id = sessions.venue_id WHERE sessions.id = ${booking.session_id}
    `) as Array<VenueRow & { date: string; start_time: string; end_time: string }>;
    if (!details[0]) throw new Error('cancellation_details_missing');
    const result = await notify({ booking, session: details[0], venue: serializeVenue(details[0]), refunded: booking.status === 'refunded' });
    if (result.status !== 'sent') throw new Error('cancellation_email_not_sent');
    await db`UPDATE admin_booking_cancellations SET email_status = 'sent', email_claim = NULL, email_claimed_at = NULL
      WHERE booking_id = ${booking.id} AND email_claim = ${token}`;
    return true;
  } catch {
    await db`UPDATE admin_booking_cancellations SET email_status = 'pending', email_claim = NULL, email_claimed_at = NULL
      WHERE booking_id = ${booking.id} AND email_claim = ${token}`;
    return false;
  }
}
