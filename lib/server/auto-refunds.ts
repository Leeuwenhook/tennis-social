import { serializeVenue, type BookingRow, type Database, type SessionRow, type VenueRow } from './database';
import {
  sendAdminAutoRefundSummary,
  sendAutoRefundEmail,
  type AutoRefundEmailInput,
  type EmailSendResult,
} from './email';
import { londonDate, londonSessionEnd } from './london-time';
import { createRefund } from './stripe';

const HOUR = 3600000;
/** Refunds are decided at least this long before the session starts. */
export const AUTO_REFUND_NOTICE_HOURS = 24;
/** How often the cron runs; each run covers the sessions until the next run. */
export const AUTO_REFUND_LOOKAHEAD_HOURS = 24;
/** Fewer players than this means nobody to play with. */
export const MIN_PLAYERS = 2;

export function isLondonAutoRefundHour(now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23',
  }).format(now) === '18';
}

/** True while the session starts 24–48 hours from now (one cron interval wide). */
export function isAutoRefundDue(date: string, startTime: string, now = new Date()) {
  const startsAt = londonSessionEnd(date, startTime);
  if (startsAt === null) return false;
  const lead = startsAt - now.getTime();
  return lead >= AUTO_REFUND_NOTICE_HOURS * HOUR && lead < (AUTO_REFUND_NOTICE_HOURS + AUTO_REFUND_LOOKAHEAD_HOURS) * HOUR;
}

type SessionCandidate = Pick<SessionRow, 'id' | 'venue_id' | 'date' | 'start_time' | 'end_time'> & {
  players: number;
  paid_players: number;
};

export type AutoRefundOutcome = {
  bookingId: string;
  sessionId: string;
  email: string;
  status: 'refunded' | 'cancelled' | 'failed';
};

type Deps = {
  refund: typeof createRefund;
  notifyCustomer: (input: AutoRefundEmailInput) => Promise<EmailSendResult>;
  notifyAdmin: (outcomes: AutoRefundOutcome[]) => Promise<EmailSendResult>;
};

const defaultDeps: Deps = {
  refund: createRefund,
  notifyCustomer: sendAutoRefundEmail,
  notifyAdmin: sendAdminAutoRefundSummary,
};

/**
 * Refunds every confirmed booking in sessions that start 24–48 hours from now
 * and still have fewer than two players, then unpublishes those sessions.
 * Checkouts still in progress count as players, so a session about to get its
 * second player is left alone. Marked-full sessions are skipped: the admin has
 * filled them offline.
 */
export async function processAutoRefunds(db: Database, now = new Date(), deps: Deps = defaultDeps) {
  const today = londonDate(now);
  const lastDate = londonDate(new Date(now.getTime() + (AUTO_REFUND_NOTICE_HOURS + AUTO_REFUND_LOOKAHEAD_HOURS + 2) * HOUR));
  const sessions = (await db`
    SELECT sessions.id, sessions.venue_id, sessions.date, sessions.start_time, sessions.end_time,
           COALESCE(SUM(bookings.participant_count) FILTER (WHERE bookings.status IN ('confirmed', 'pending_payment')), 0)::integer AS players,
           COALESCE(SUM(bookings.participant_count) FILTER (WHERE bookings.status = 'confirmed'), 0)::integer AS paid_players
    FROM sessions LEFT JOIN bookings ON bookings.session_id = sessions.id
    WHERE sessions.status = 'published' AND NOT sessions.marked_full
      AND sessions.date BETWEEN ${today} AND ${lastDate}
    GROUP BY sessions.id
  `) as SessionCandidate[];
  const due = sessions.filter(
    (session) => session.paid_players > 0 && session.players < MIN_PLAYERS && isAutoRefundDue(session.date, session.start_time, now),
  );

  const outcomes: AutoRefundOutcome[] = [];
  for (const session of due) {
    const staleBefore = new Date(now.getTime() - 10 * 60000).toISOString();
    const claimedAt = new Date().toISOString();
    const bookings = (await db`
      UPDATE bookings SET auto_refund_status = 'processing', auto_refund_claimed_at = ${claimedAt}
      WHERE session_id = ${session.id} AND status = 'confirmed'
        AND (auto_refund_status = 'none' OR (auto_refund_status = 'processing' AND auto_refund_claimed_at < ${staleBefore}))
      RETURNING *
    `) as BookingRow[];
    const venueRows = (await db`SELECT * FROM venues WHERE id = ${session.venue_id}`) as VenueRow[];
    let allSettled = bookings.length > 0;
    for (const booking of bookings) {
      let outcome: AutoRefundOutcome['status'];
      try {
        outcome = await refundBooking(db, booking, deps);
      } catch {
        console.error('Auto-refund database update failed', booking.id);
        outcome = 'failed';
      }
      outcomes.push({ bookingId: booking.id, sessionId: session.id, email: booking.email, status: outcome });
      if (outcome === 'failed') {
        allSettled = false;
        continue;
      }
      if (venueRows[0]) {
        try {
          await deps.notifyCustomer({ booking, session, venue: serializeVenue(venueRows[0]), refunded: outcome === 'refunded' });
        } catch {
          console.error('Auto-refund email failed', booking.id);
        }
      }
    }
    // Nobody is left to play, so the session stops taking lone bookings.
    if (allSettled) {
      await db`UPDATE sessions SET status = 'draft', updated_at = ${new Date().toISOString()}
        WHERE id = ${session.id} AND status = 'published'`;
    }
  }

  if (outcomes.length) {
    try {
      await deps.notifyAdmin(outcomes);
    } catch {
      console.error('Auto-refund admin summary failed');
    }
  }
  return {
    sessions: due.length,
    refunded: outcomes.filter((item) => item.status === 'refunded').length,
    cancelled: outcomes.filter((item) => item.status === 'cancelled').length,
    failed: outcomes.filter((item) => item.status === 'failed').length,
  };
}

/** Refunds one claimed booking through Stripe (or cancels a free one) and releases its places. */
async function refundBooking(db: Database, booking: BookingRow, deps: Deps): Promise<AutoRefundOutcome['status']> {
  const paid = booking.total_pence > 0 && Boolean(booking.stripe_payment_intent_id);
  let refundId: string | null = null;
  try {
    if (paid) {
      const refund = await deps.refund({
        paymentIntentId: booking.stripe_payment_intent_id!,
        bookingId: booking.id,
        reason: 'auto_no_partner',
      });
      refundId = refund.id;
    }
  } catch {
    console.error('Auto-refund Stripe call failed', booking.id);
    await db`UPDATE bookings SET auto_refund_status = 'failed', auto_refund_claimed_at = NULL WHERE id = ${booking.id}`;
    return 'failed';
  }

  const now = new Date().toISOString();
  const status = paid ? 'refunded' : 'cancelled';
  // The charge.refunded webhook may already have relabelled the booking and
  // released its places; only a still-confirmed booking releases them here.
  await db`
    WITH updated AS (
      UPDATE bookings SET status = ${status}, updated_at = ${now}
      WHERE id = ${booking.id} AND status = 'confirmed'
      RETURNING session_id, participant_count
    )
    UPDATE sessions AS sessions
    SET booked_spots = GREATEST(0, sessions.booked_spots - updated.participant_count), updated_at = ${now}
    FROM updated
    WHERE sessions.id = updated.session_id
  `;
  await db`UPDATE bookings SET auto_refund_status = 'refunded', auto_refunded_at = ${now},
    auto_refund_id = ${refundId}, auto_refund_claimed_at = NULL WHERE id = ${booking.id}`;
  return status;
}
