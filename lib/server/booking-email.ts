import { venues } from '../demo-data';
import { serializeVenue, type BookingRow, type Database, type SessionRow, type VenueRow } from './database';
import {
  isEmailConfigured,
  sendBookingConfirmationEmail as sendEmail,
} from './email';

type BookingWithSession = BookingRow &
  Pick<
    SessionRow,
    | 'venue_id'
    | 'date'
    | 'start_time'
    | 'end_time'
    | 'description'
    | 'description_zh'
  >;

export type BookingEmailDelivery =
  | { status: 'sent'; messageId?: string }
  | { status: 'skipped' | 'in_progress' | 'failed' | 'not_applicable' };

const STALE_CLAIM_AFTER_MS = 10 * 60 * 1000;

export async function sendConfirmedBookingEmail(
  db: Database,
  bookingId: string,
): Promise<BookingEmailDelivery> {
  if (!isEmailConfigured()) {
    console.warn(
      `Confirmation email skipped for ${bookingId}: SMTP_USER, SMTP_PASSWORD, or EMAIL_FROM is not configured.`,
    );
    return { status: 'skipped' };
  }

  const rows = (await db`
    SELECT bookings.*, sessions.venue_id, sessions.date, sessions.start_time,
           sessions.end_time, sessions.description, sessions.description_zh
    FROM bookings
    JOIN sessions ON sessions.id = bookings.session_id
    WHERE bookings.id = ${bookingId}
  `) as BookingWithSession[];
  const booking = rows[0];
  if (!booking || booking.status !== 'confirmed')
    return { status: 'not_applicable' };
  if (booking.confirmation_email_status === 'sent') {
    return {
      status: 'sent',
      messageId: booking.confirmation_email_message_id ?? undefined,
    };
  }

  const claimedAt = new Date().toISOString();
  const staleClaimBefore = new Date(
    Date.now() - STALE_CLAIM_AFTER_MS,
  ).toISOString();
  const claimedRows = (await db`
    UPDATE bookings
    SET confirmation_email_status = 'sending',
        confirmation_email_claimed_at = ${claimedAt},
        updated_at = ${claimedAt}
    WHERE id = ${bookingId}
      AND status = 'confirmed'
      AND (
        confirmation_email_status = 'pending'
        OR (
          confirmation_email_status = 'sending'
          AND (
            confirmation_email_claimed_at IS NULL
            OR confirmation_email_claimed_at < ${staleClaimBefore}
          )
        )
      )
    RETURNING *
  `) as BookingRow[];
  const claimedBooking = claimedRows[0];
  if (!claimedBooking) return { status: 'in_progress' };

  const venueRows = (await db`
    SELECT id, name, name_zh, area, area_zh, address, address_zh, postcode, photo,
           peak_price_pence, off_peak_price_pence, created_at, updated_at
    FROM venues
    WHERE id = ${booking.venue_id}
  `) as VenueRow[];
  const venue = venueRows[0]
    ? serializeVenue(venueRows[0])
    : venues.find((item) => item.id === booking.venue_id) ?? venues[0];
  try {
    const result = await sendEmail({
      booking: claimedBooking,
      session: booking,
      venue,
    });
    const sentAt = new Date().toISOString();
    await db`
      UPDATE bookings
      SET confirmation_email_status = 'sent',
          confirmation_email_sent_at = ${sentAt},
          confirmation_email_message_id = ${result.messageId ?? null},
          confirmation_email_claimed_at = NULL,
          updated_at = ${sentAt}
      WHERE id = ${bookingId}
        AND status = 'confirmed'
        AND confirmation_email_status = 'sending'
        AND confirmation_email_claimed_at = ${claimedAt}
    `;
    return { status: 'sent', messageId: result.messageId };
  } catch (error) {
    await db`
      UPDATE bookings
      SET confirmation_email_status = 'pending',
          confirmation_email_claimed_at = NULL,
          updated_at = ${new Date().toISOString()}
      WHERE id = ${bookingId}
        AND status = 'confirmed'
        AND confirmation_email_status = 'sending'
        AND confirmation_email_claimed_at = ${claimedAt}
    `;
    throw error;
  }
}

/** Separate claim from the customer email; admin failures never escape into checkout. */
export async function sendAdminBookingNotificationOnce(db: Database, bookingId: string): Promise<BookingEmailDelivery> {
  const claimedAt = new Date().toISOString();
  try {
    const { adminNotifyRecipients, sendAdminBookingNotification } = await import('./email');
    if (!adminNotifyRecipients().length) { console.info('Admin notification skipped: ADMIN_NOTIFY_EMAIL not configured.'); return { status: 'skipped' }; }
    if (!isEmailConfigured()) return { status: 'skipped' };
    const rows = await db`
      UPDATE bookings SET admin_notification_status = 'sending', admin_notification_claimed_at = ${claimedAt}
      WHERE id = ${bookingId} AND status = 'confirmed'
        AND (admin_notification_status = 'pending' OR (admin_notification_status = 'sending'
          AND (admin_notification_claimed_at IS NULL OR admin_notification_claimed_at < ${new Date(Date.now() - STALE_CLAIM_AFTER_MS).toISOString()})))
      RETURNING *
    ` as BookingRow[];
    if (!rows[0]) return { status: 'not_applicable' };
    const sessions = await db`SELECT * FROM sessions WHERE id = ${rows[0].session_id}` as SessionRow[];
    const venueRows = await db`SELECT * FROM venues WHERE id = ${sessions[0].venue_id}` as VenueRow[];
    const result = await sendAdminBookingNotification({ booking: rows[0], session: sessions[0], venue: serializeVenue(venueRows[0]) });
    await db`UPDATE bookings SET admin_notification_status = ${result.status}, admin_notification_sent_at = ${result.status === 'sent' ? new Date().toISOString() : null}, admin_notification_claimed_at = NULL
      WHERE id = ${bookingId} AND admin_notification_status = 'sending' AND admin_notification_claimed_at = ${claimedAt}`;
    return { status: result.status };
  } catch {
    console.error('Admin booking notification failed', bookingId);
    try { await db`UPDATE bookings SET admin_notification_status = 'pending', admin_notification_claimed_at = NULL WHERE id = ${bookingId} AND admin_notification_claimed_at = ${claimedAt}`; } catch { console.error('Admin notification claim reset failed', bookingId); }
    return { status: 'failed' };
  }
}
