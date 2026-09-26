import { venues } from '../demo-data';
import {
  isEmailConfigured,
  sendBookingReminderEmail,
} from './email';
import {
  serializeVenue,
  type BookingRow,
  type Database,
  type SessionRow,
  type VenueRow,
} from './database';

type BookingReminderCandidate = BookingRow &
  Pick<SessionRow, 'venue_id' | 'date' | 'start_time' | 'end_time' | 'description' | 'description_zh'>;

export type BookingReminderRunResult = {
  status: 'outside_window' | 'email_not_configured' | 'sent';
  date?: string;
  candidates?: number;
  sent?: number;
  skipped?: number;
  failed?: number;
};

const LONDON_TIME_ZONE = 'Europe/London';
const STALE_CLAIM_AFTER_MS = 10 * 60 * 1000;

function londonDateTime(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function tomorrowDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export async function sendDueBookingReminders(
  db: Database,
  now = new Date(),
): Promise<BookingReminderRunResult> {
  const london = londonDateTime(now);
  if (Number(london.hour) < 18) return { status: 'outside_window' };
  if (!isEmailConfigured()) return { status: 'email_not_configured' };

  const reminderDate = tomorrowDate(`${london.year}-${london.month}-${london.day}`);
  const staleClaimBefore = new Date(now.getTime() - STALE_CLAIM_AFTER_MS).toISOString();
  const candidates = await db`
    SELECT bookings.*, sessions.venue_id, sessions.date, sessions.start_time,
           sessions.end_time, sessions.description, sessions.description_zh
    FROM bookings
    JOIN sessions ON sessions.id = bookings.session_id
    WHERE bookings.status = 'confirmed'
      AND sessions.date = ${reminderDate}
      AND (
        bookings.reminder_email_status = 'pending'
        OR (
          bookings.reminder_email_status = 'sending'
          AND (
            bookings.reminder_email_claimed_at IS NULL
            OR bookings.reminder_email_claimed_at < ${staleClaimBefore}
          )
        )
      )
    ORDER BY sessions.start_time, bookings.created_at
  ` as BookingReminderCandidate[];

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const booking of candidates) {
    const claimedAt = new Date().toISOString();
    const claimedRows = await db`
      UPDATE bookings
      SET reminder_email_status = 'sending',
          reminder_email_claimed_at = ${claimedAt},
          updated_at = ${claimedAt}
      WHERE id = ${booking.id}
        AND status = 'confirmed'
        AND (
          reminder_email_status = 'pending'
          OR (
            reminder_email_status = 'sending'
            AND (
              reminder_email_claimed_at IS NULL
              OR reminder_email_claimed_at < ${staleClaimBefore}
            )
          )
        )
      RETURNING *
    ` as BookingRow[];
    const claimedBooking = claimedRows[0];
    if (!claimedBooking) {
      skipped += 1;
      continue;
    }

    try {
      const venueRows = await db`
        SELECT id, name, name_zh, area, area_zh, photo,
               peak_price_pence, off_peak_price_pence, created_at, updated_at
        FROM venues
        WHERE id = ${booking.venue_id}
      ` as VenueRow[];
      const venue = venueRows[0]
        ? serializeVenue(venueRows[0])
        : venues.find((item) => item.id === booking.venue_id) ?? venues[0];
      const result = await sendBookingReminderEmail({
        booking: claimedBooking,
        session: booking,
        venue,
      });
      if (result.status === 'skipped') {
        await db`
          UPDATE bookings
          SET reminder_email_status = 'pending', reminder_email_claimed_at = NULL,
              updated_at = ${new Date().toISOString()}
          WHERE id = ${booking.id}
            AND reminder_email_status = 'sending'
            AND reminder_email_claimed_at = ${claimedAt}
        `;
        skipped += 1;
        continue;
      }

      const sentAt = new Date().toISOString();
      await db`
        UPDATE bookings
        SET reminder_email_status = 'sent',
            reminder_email_sent_at = ${sentAt},
            reminder_email_message_id = ${result.messageId ?? null},
            reminder_email_claimed_at = NULL,
            updated_at = ${sentAt}
        WHERE id = ${booking.id}
          AND status = 'confirmed'
          AND reminder_email_status = 'sending'
          AND reminder_email_claimed_at = ${claimedAt}
      `;
      sent += 1;
    } catch (error) {
      await db`
        UPDATE bookings
        SET reminder_email_status = 'pending',
            reminder_email_claimed_at = NULL,
            updated_at = ${new Date().toISOString()}
        WHERE id = ${booking.id}
          AND status = 'confirmed'
          AND reminder_email_status = 'sending'
          AND reminder_email_claimed_at = ${claimedAt}
      `;
      failed += 1;
      console.error(`Unable to send booking reminder for ${booking.id}`, error);
    }
  }

  return {
    status: 'sent',
    date: reminderDate,
    candidates: candidates.length,
    sent,
    skipped,
    failed,
  };
}
