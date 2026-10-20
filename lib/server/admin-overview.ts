import { AUTO_REFUND_NOTICE_HOURS, MIN_PLAYERS } from './auto-refunds';
import type { Database } from './database';
import { londonDate, londonDateTime, londonSessionEnd } from './london-time';

const HOUR = 3600000;
const DAY = 24 * HOUR;

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Monday to Sunday of the current London week. */
export function londonWeek(now = new Date()) {
  const today = londonDate(now);
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = shiftDate(today, -weekday);
  return { start, end: shiftDate(start, 6) };
}

/**
 * When the daily 18:00 London auto-refund run will decide this session: the
 * last 18:00 at or before 24 hours ahead of the start. Null for a bad time.
 */
export function autoRefundDecisionAt(date: string, startTime: string) {
  const startsAt = londonSessionEnd(date, startTime);
  if (startsAt === null) return null;
  const latest = startsAt - AUTO_REFUND_NOTICE_HOURS * HOUR;
  // Walk back hour by hour to the most recent 18:00 London (at most a day).
  for (let instant = Math.floor(latest / HOUR) * HOUR; instant > latest - DAY - HOUR; instant -= HOUR) {
    const parts = londonDateTime(new Date(instant));
    if (parts.hour === '18' && parts.minute === '00') return new Date(instant);
  }
  return null;
}

type SessionRow = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_spots: number;
  marked_full: boolean;
  status: 'published' | 'draft';
  venue_name: string;
};

type RosterRow = {
  id: string;
  session_id: string;
  contact_name: string;
  email: string;
  phone: string;
  participants_json: string;
  participant_count: number;
  format: string;
  total_pence: number;
  status: string;
};

function levels(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function loadAdminOverview(db: Database, now = new Date()) {
  const today = londonDate(now);
  const lastDay = shiftDate(today, 6);
  const week = londonWeek(now);
  // created_at is UTC ISO text, so compare against the UTC instants of London midnight.
  const weekFrom = new Date(londonSessionEnd(week.start, '00:00') ?? 0).toISOString();
  const weekTo = new Date(londonSessionEnd(shiftDate(week.end, 1), '00:00') ?? 0).toISOString();
  const [sessions, roster, counts, weekRows] = await Promise.all([
    db`
      SELECT sessions.id, sessions.date, sessions.start_time, sessions.end_time, sessions.capacity,
             sessions.booked_spots, sessions.marked_full, sessions.status, venues.name AS venue_name
      FROM sessions JOIN venues ON venues.id = sessions.venue_id
      WHERE sessions.date BETWEEN ${today} AND ${lastDay}
      ORDER BY sessions.date, sessions.start_time
    ` as unknown as Promise<SessionRow[]>,
    db`
      SELECT bookings.id, bookings.session_id, bookings.contact_name, bookings.email, bookings.phone,
             bookings.participants_json, bookings.participant_count, bookings.format, bookings.total_pence, bookings.status
      FROM bookings JOIN sessions ON sessions.id = bookings.session_id
      WHERE sessions.date BETWEEN ${today} AND ${lastDay} AND bookings.status IN ('confirmed', 'pending_payment')
      ORDER BY bookings.created_at
    ` as unknown as Promise<RosterRow[]>,
    db`
      SELECT (SELECT COUNT(*) FROM reservation_requests WHERE status = 'pending')::integer AS pending_requests,
             (SELECT COUNT(*) FROM session_reviews WHERE status = 'pending')::integer AS pending_reviews
    ` as unknown as Promise<Array<{ pending_requests: number; pending_reviews: number }>>,
    db`
      SELECT COALESCE(SUM(bookings.total_pence), 0)::integer AS revenue_pence,
             COUNT(*)::integer AS bookings,
             COALESCE(SUM(bookings.participant_count), 0)::integer AS players
      FROM bookings
      WHERE bookings.status = 'confirmed'
        AND bookings.created_at >= ${weekFrom} AND bookings.created_at < ${weekTo}
    ` as unknown as Promise<Array<{ revenue_pence: number; bookings: number; players: number }>>,
  ]);

  const nowMs = now.getTime();
  const result = sessions
    .filter((session) => (londonSessionEnd(session.date, session.end_time) ?? Infinity) > nowMs)
    .map((session) => {
      const bookings = roster.filter((row) => row.session_id === session.id);
      const players = bookings.reduce((sum, row) => sum + row.participant_count, 0);
      const paidPlayers = bookings.filter((row) => row.status === 'confirmed').reduce((sum, row) => sum + row.participant_count, 0);
      const decision = autoRefundDecisionAt(session.date, session.start_time);
      const atRisk =
        (londonSessionEnd(session.date, session.start_time) ?? Infinity) <= nowMs + 48 * HOUR &&
        session.status === 'published' && !session.marked_full && paidPlayers > 0 && players < MIN_PLAYERS && decision !== null && decision.getTime() > nowMs;
      return {
        id: session.id,
        date: session.date,
        startTime: session.start_time,
        endTime: session.end_time,
        venueName: session.venue_name,
        capacity: session.capacity,
        bookedSpots: session.booked_spots,
        markedFull: session.marked_full,
        status: session.status,
        autoRefundAt: atRisk ? decision!.toISOString() : null,
        roster: bookings.map((row) => ({
          id: row.id,
          contactName: row.contact_name,
          email: row.email,
          phone: row.phone,
          participants: levels(row.participants_json),
          participantCount: row.participant_count,
          format: row.format,
          totalPence: row.total_pence,
          status: row.status,
        })),
      };
    });

  return {
    sessions: result,
    pendingRequests: counts[0]?.pending_requests ?? 0,
    pendingReviews: counts[0]?.pending_reviews ?? 0,
    week: { ...week, revenuePence: weekRows[0]?.revenue_pence ?? 0, bookings: weekRows[0]?.bookings ?? 0, players: weekRows[0]?.players ?? 0 },
  };
}
