import { adminCursor, readAdminCursor } from './admin-pagination';
import { serializeBooking, type BookingRow, type Database } from './database';
import { londonDate } from './london-time';

const PAGE_SIZE = 50;
const STATUSES = ['pending_payment', 'confirmed', 'expired', 'payment_failed', 'cancelled', 'refunded'];

export type BookingSearch = {
  scope: 'upcoming' | 'past' | 'all';
  venueId: string | null;
  status: string | null;
  query: string | null;
  offset: number;
};

export function parseBookingSearch(params: URLSearchParams): BookingSearch {
  const scope = params.get('scope');
  const status = params.get('status');
  const query = params.get('q')?.trim().slice(0, 100) || null;
  return {
    scope: scope === 'past' || scope === 'all' ? scope : 'upcoming',
    venueId: params.get('venue') || null,
    status: status && STATUSES.includes(status) ? status : null,
    query,
    offset: Math.max(0, Math.min(100000, Math.floor(Number(params.get('offset')) || 0))),
  };
}

/** Escapes LIKE wildcards so a search for "50%" matches literally. */
export function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/**
 * Admin booking list with the session and venue joined in. Upcoming sorts
 * soonest first; past and all sort most recent first.
 */
export async function searchAdminBookings(db: Database, params: URLSearchParams, now = new Date()) {
  const search = parseBookingSearch(params);
  const decoded = readAdminCursor(params.get('cursor'));
  const cursor = decoded?.date && decoded.start ? decoded : null;
  const today = londonDate(now);
  const pattern = search.query ? likePattern(search.query) : null;
  const rows = (await db`
    SELECT bookings.*, sessions.date AS session_date, sessions.start_time AS session_start,
           sessions.end_time AS session_end, sessions.venue_id, venues.name AS venue_name,
           (cancellations.booking_id IS NOT NULL AND (cancellations.completed_at IS NULL OR cancellations.email_status <> 'sent')) AS cancellation_email_pending
    FROM bookings
    JOIN sessions ON sessions.id = bookings.session_id
    JOIN venues ON venues.id = sessions.venue_id
    LEFT JOIN admin_booking_cancellations AS cancellations ON cancellations.booking_id = bookings.id
    WHERE (${search.scope} <> 'upcoming' OR sessions.date >= ${today})
      AND (${search.scope} <> 'past' OR sessions.date < ${today})
      AND (${search.venueId}::text IS NULL OR sessions.venue_id = ${search.venueId})
      AND (${search.status}::text IS NULL OR bookings.status = ${search.status})
      AND (${pattern}::text IS NULL OR bookings.contact_name ILIKE ${pattern} OR bookings.email ILIKE ${pattern}
           OR bookings.phone ILIKE ${pattern} OR bookings.id ILIKE ${pattern})
      AND (${cursor?.id ?? null}::text IS NULL OR (
        (${search.scope} = 'upcoming' AND (sessions.date, sessions.start_time) > (${cursor?.date ?? null}, ${cursor?.start ?? null}))
        OR (${search.scope} <> 'upcoming' AND (sessions.date, sessions.start_time) < (${cursor?.date ?? null}, ${cursor?.start ?? null}))
        OR ((sessions.date, sessions.start_time) = (${cursor?.date ?? null}, ${cursor?.start ?? null})
          AND (bookings.created_at, bookings.id) < (${cursor?.created ?? null}, ${cursor?.id ?? null}))
      ))
    ORDER BY
      CASE WHEN ${search.scope} = 'upcoming' THEN sessions.date END ASC,
      CASE WHEN ${search.scope} = 'upcoming' THEN sessions.start_time END ASC,
      sessions.date DESC, sessions.start_time DESC, bookings.created_at DESC, bookings.id DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${cursor ? 0 : search.offset}
  `) as Array<BookingRow & { session_date: string; session_start: string; session_end: string; venue_id: string; venue_name: string; cancellation_email_pending: boolean }>;
  return {
    bookings: rows.slice(0, PAGE_SIZE).map((row) => ({
      ...serializeBooking(row),
      cancellationEmailPending: row.cancellation_email_pending,
      paid: row.total_pence > 0 && Boolean(row.stripe_payment_intent_id),
      session: { date: row.session_date, startTime: row.session_start, endTime: row.session_end, venueId: row.venue_id, venueName: row.venue_name },
    })),
    nextCursor: rows.length > PAGE_SIZE ? adminCursor({ id: rows[PAGE_SIZE - 1].id, created: rows[PAGE_SIZE - 1].created_at, date: rows[PAGE_SIZE - 1].session_date, start: rows[PAGE_SIZE - 1].session_start }) : null,
    nextOffset: rows.length > PAGE_SIZE ? search.offset + PAGE_SIZE : null,
  };
}
