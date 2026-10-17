import {
  serializeVenue,
  type BookingRow,
  type Database,
  type SessionRow,
  type VenueRow,
} from './database';
import {
  isEmailConfigured,
  sendBookingFollowupEmail,
  type BookingFollowupInput,
  type EmailSendResult,
} from './email';
import { londonDate, londonSessionEnd } from './london-time';
import { signToken } from './signed-token';
import { getRuntimeEnv } from './runtime';

const HOUR = 3600000;
const SITE_ORIGIN = 'https://www.tennismatch.space';
type Candidate = BookingRow &
  Pick<
    SessionRow,
    | 'venue_id'
    | 'date'
    | 'start_time'
    | 'end_time'
  >;
export function isLondonFollowupHour(now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23',
  }).format(now) === '21';
}

export function isFollowupDue(
  sessionDate: string,
  endTime: string,
  now = new Date(),
) {
  const endedAt = londonSessionEnd(sessionDate, endTime);
  return (
    endedAt !== null &&
    now.getTime() >= endedAt + HOUR &&
    now.getTime() <= endedAt + 72 * HOUR
  );
}

export async function sendDueBookingFollowups(
  db: Database,
  now = new Date(),
  send: (
    input: BookingFollowupInput,
  ) => Promise<EmailSendResult> = sendBookingFollowupEmail,
) {
  if (!isEmailConfigured()) return { status: 'email_not_configured' as const };
  if (
    !getRuntimeEnv().REVIEW_TOKEN_SECRET ||
    Buffer.byteLength(getRuntimeEnv().REVIEW_TOKEN_SECRET!) < 32
  )
    return { status: 'token_not_configured' as const };
  const today = londonDate(now);
  const earliest = londonDate(new Date(now.getTime() - 72 * HOUR));
  const staleBefore = new Date(now.getTime() - 10 * 60000).toISOString();
  const candidates = (await db`
    SELECT bookings.*, sessions.venue_id, sessions.date, sessions.start_time,
           sessions.end_time
    FROM bookings JOIN sessions ON sessions.id = bookings.session_id
    WHERE bookings.status = 'confirmed'
      AND NOT EXISTS (SELECT 1 FROM email_suppressions WHERE email = lower(trim(bookings.email)))
      AND sessions.date BETWEEN ${earliest} AND ${today}
      AND (bookings.followup_email_status = 'pending' OR (bookings.followup_email_status = 'sending'
        AND (bookings.followup_email_claimed_at IS NULL OR bookings.followup_email_claimed_at < ${staleBefore})))
    ORDER BY sessions.date, sessions.end_time, bookings.created_at LIMIT 100
  `) as Candidate[];
  let sent = 0,
    skipped = 0,
    failed = 0;
  for (const booking of candidates) {
    if (!isFollowupDue(booking.date, booking.end_time, now)) {
      skipped++;
      continue;
    }
    const claimedAt = new Date().toISOString();
    try {
      const rows = (await db`
        UPDATE bookings SET followup_email_status = 'sending', followup_email_claimed_at = ${claimedAt}
        WHERE id = ${booking.id} AND status = 'confirmed'
          AND NOT EXISTS (SELECT 1 FROM email_suppressions WHERE email = lower(trim(bookings.email)))
          AND (followup_email_status = 'pending' OR (followup_email_status = 'sending'
            AND (followup_email_claimed_at IS NULL OR followup_email_claimed_at < ${staleBefore})))
        RETURNING *
      `) as BookingRow[];
      if (!rows[0]) {
        skipped++;
        continue;
      }
      const venueRows =
        (await db`SELECT * FROM venues WHERE id = ${booking.venue_id}`) as VenueRow[];
      if (!venueRows[0]) throw new Error('venue_not_found');
      const venue = serializeVenue(venueRows[0]);
      const lastDate = londonDate(new Date(now.getTime() + 7 * 24 * HOUR));
      const next = (await db`
        SELECT sessions.id, sessions.date, sessions.start_time, sessions.end_time, venues.name, venues.name_zh
        FROM sessions JOIN venues ON venues.id = sessions.venue_id
        WHERE sessions.status = 'published' AND sessions.booked_spots < sessions.capacity
          AND (sessions.venue_id = ${booking.venue_id} OR venues.area = ${venue.area})
          AND sessions.date BETWEEN ${today} AND ${lastDate}
          AND (sessions.date > ${today} OR sessions.start_time > ${londonDateTimeClock(now)})
        ORDER BY CASE WHEN sessions.venue_id = ${booking.venue_id} THEN 0 ELSE 1 END, sessions.date, sessions.start_time
        LIMIT 3
      `) as BookingFollowupInput['nextSessions'];
      // Recheck status and suppression immediately before SMTP (also enforced in the claim).
      const eligible =
        (await db`SELECT id FROM bookings WHERE id = ${booking.id} AND status = 'confirmed'
        AND followup_email_status = 'sending' AND followup_email_claimed_at = ${claimedAt}
        AND NOT EXISTS (SELECT 1 FROM email_suppressions WHERE email = lower(trim(bookings.email)))`) as Array<{
          id: string;
        }>;
      if (!eligible.length) {
        await db`UPDATE bookings SET followup_email_status = 'skipped', followup_email_claimed_at = NULL WHERE id = ${booking.id} AND followup_email_claimed_at = ${claimedAt}`;
        skipped++;
        continue;
      }
      const token = signToken(
        'unsubscribe',
        { email: rows[0].email.trim().toLowerCase(), v: 1 },
        365 * 86400,
        now,
      );
      const result = await send({
        booking: rows[0],
        session: booking,
        venue,
        nextSessions: next,
        unsubscribeUrl: `${SITE_ORIGIN}/api/email/unsubscribe?t=${encodeURIComponent(token)}`,
      });
      await db`UPDATE bookings SET followup_email_status = ${result.status === 'sent' ? 'sent' : 'pending'},
        followup_email_sent_at = ${result.status === 'sent' ? new Date().toISOString() : null},
        followup_email_message_id = ${result.messageId ?? null}, followup_email_claimed_at = NULL
        WHERE id = ${booking.id} AND followup_email_status = 'sending' AND followup_email_claimed_at = ${claimedAt}`;
      if (result.status === 'sent') sent++;
      else skipped++;
    } catch {
      failed++;
      console.error('Booking follow-up failed', booking.id);
      try {
        await db`UPDATE bookings SET followup_email_status = 'pending', followup_email_claimed_at = NULL WHERE id = ${booking.id} AND followup_email_claimed_at = ${claimedAt}`;
      } catch {
        console.error('Follow-up claim reset failed', booking.id);
      }
    }
  }
  return {
    status: 'sent' as const,
    candidates: candidates.length,
    sent,
    skipped,
    failed,
  };
}
function londonDateTimeClock(now: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}
