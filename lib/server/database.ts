import { neon } from '@neondatabase/serverless';

import { GAME_FORMATS, RACKET_PRICE_PENCE, type GameFormat } from '../demo-data';
import { getRuntimeEnv } from './runtime';
import { createDemoSeed } from './seed';

export type SessionRow = {
  id: string;
  venue_id: string;
  date: string;
  start_time: string;
  end_time: string;
  price_pence: number;
  capacity: number;
  booked_spots: number;
  formats_json: string;
  status: 'published' | 'draft';
  description: string;
  description_zh: string;
};

export type VenueRow = {
  id: string;
  name: string;
  name_zh: string;
  area: string;
  area_zh: string;
  photo: string;
  peak_price_pence: number;
  off_peak_price_pence: number;
  created_at: string;
  updated_at: string;
};

export type BookingRow = {
  id: string;
  session_id: string;
  user_id: string | null;
  contact_name: string;
  email: string;
  phone: string;
  participants_json: string;
  format: GameFormat;
  participant_count: number;
  racket_count: number;
  session_price_pence: number;
  racket_price_pence: number;
  total_pence: number;
  status: 'pending_payment' | 'confirmed' | 'expired' | 'payment_failed' | 'cancelled' | 'refunded';
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  confirmation_email_status: 'pending' | 'sending' | 'sent';
  confirmation_email_sent_at: string | null;
  confirmation_email_message_id: string | null;
  confirmation_email_claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationRequestRow = {
  id: string;
  venue_id: string;
  preferred_date: string;
  start_time: string;
  end_time: string;
  contact_name: string;
  email: string;
  phone: string;
  message: string;
  status: 'pending' | 'reviewing' | 'completed';
  created_at: string;
  updated_at: string;
};

export type Database = ReturnType<typeof neon>;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('database_not_configured');
    this.name = 'DatabaseNotConfiguredError';
  }
}

export function database(): Database {
  const { DATABASE_URL, POSTGRES_URL } = getRuntimeEnv();
  const connectionString = DATABASE_URL || POSTGRES_URL;
  if (!connectionString) throw new DatabaseNotConfiguredError();
  return neon(connectionString);
}

function venueInsert(db: Database, venue: ReturnType<typeof createDemoSeed>['venues'][number], now: string) {
  return db`
    INSERT INTO venues (
      id, name, name_zh, area, area_zh, photo, peak_price_pence,
      off_peak_price_pence, created_at, updated_at
    ) VALUES (
      ${venue.id}, ${venue.name}, ${venue.nameZh}, ${venue.area}, ${venue.areaZh}, ${venue.photo},
      ${venue.peakPricePence}, ${venue.offPeakPricePence}, ${now}, ${now}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function sessionInsert(db: Database, session: ReturnType<typeof createDemoSeed>['sessions'][number], now: string) {
  return db`
    INSERT INTO sessions (
      id, venue_id, date, start_time, end_time, price_pence, capacity,
      booked_spots, formats_json, status, description, description_zh, created_at, updated_at
    ) VALUES (
      ${session.id}, ${session.venueId}, ${session.date}, ${session.startTime}, ${session.endTime},
      ${session.pricePence}, ${session.capacity}, ${session.bookedSpots}, ${JSON.stringify(session.formats)}, ${session.status},
      ${session.description}, ${session.descriptionZh}, ${now}, ${now}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function bookingInsert(db: Database, booking: ReturnType<typeof createDemoSeed>['bookings'][number], now: string) {
  return db`
    INSERT INTO bookings (
      id, session_id, contact_name, email, phone, participants_json,
      format, participant_count, racket_count, session_price_pence, racket_price_pence,
      total_pence, status, expires_at, created_at, updated_at
    ) VALUES (
      ${booking.id}, ${booking.sessionId}, ${booking.contactName}, ${booking.email}, ${booking.phone},
      ${JSON.stringify(booking.participants)}, ${booking.format}, ${booking.participants.length}, ${booking.racketCount},
      ${booking.totalPence - booking.racketCount * RACKET_PRICE_PENCE}, ${RACKET_PRICE_PENCE}, ${booking.totalPence}, ${booking.status},
      NULL, ${booking.createdAt || now}, ${now}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function ensureSeeded(db = database()) {
  const now = new Date().toISOString();
  const seed = createDemoSeed(new Date(now));
  await db.transaction([
    ...seed.venues.map((venue) => venueInsert(db, venue, now)),
    ...seed.sessions.map((session) => sessionInsert(db, session, now)),
    ...seed.bookings.map((booking) => bookingInsert(db, booking, now)),
  ]);
}

export async function resetSeed(db = database()) {
  const now = new Date().toISOString();
  const seed = createDemoSeed(new Date(now));
  await db.transaction([
    db`DELETE FROM bookings`,
    db`DELETE FROM webhook_events`,
    db`DELETE FROM sessions`,
    ...seed.venues.map((venue) => venueInsert(db, venue, now)),
    ...seed.sessions.map((session) => sessionInsert(db, session, now)),
    ...seed.bookings.map((booking) => bookingInsert(db, booking, now)),
  ]);
  return seed;
}

export function serializeVenue(row: VenueRow) {
  return {
    id: row.id,
    name: row.name,
    nameZh: row.name_zh,
    area: row.area,
    areaZh: row.area_zh,
    photo: row.photo,
    peakPricePence: row.peak_price_pence,
    offPeakPricePence: row.off_peak_price_pence,
  };
}

export function serializeReservationRequest(row: ReservationRequestRow) {
  return {
    id: row.id,
    venueId: row.venue_id,
    preferredDate: row.preferred_date,
    startTime: row.start_time,
    endTime: row.end_time,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function expireStaleReservations(db = database()) {
  const now = new Date().toISOString();
  await db`
    WITH expired AS (
      UPDATE bookings
      SET status = 'expired', updated_at = ${now}
      WHERE status = 'pending_payment'
        AND expires_at IS NOT NULL
        AND expires_at < ${now}
      RETURNING session_id, participant_count
    ), released AS (
      SELECT session_id, SUM(participant_count)::integer AS participant_count
      FROM expired
      GROUP BY session_id
    )
    UPDATE sessions AS sessions
    SET booked_spots = GREATEST(0, sessions.booked_spots - released.participant_count),
        updated_at = ${now}
    FROM released
    WHERE sessions.id = released.session_id
  `;
}

export async function releaseBooking(
  db: Database,
  bookingId: string,
  status: 'payment_failed' | 'expired' | 'cancelled',
) {
  const now = new Date().toISOString();
  await db`
    WITH released AS (
      UPDATE bookings
      SET status = ${status}, updated_at = ${now}
      WHERE id = ${bookingId} AND status = 'pending_payment'
      RETURNING session_id, participant_count
    )
    UPDATE sessions AS sessions
    SET booked_spots = GREATEST(0, sessions.booked_spots - released.participant_count),
        updated_at = ${now}
    FROM released
    WHERE sessions.id = released.session_id
  `;
}

export function serializeSession(row: SessionRow) {
  let formats: GameFormat[] = [...GAME_FORMATS];
  try {
    const parsed = JSON.parse(row.formats_json) as unknown;
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((value): value is GameFormat => GAME_FORMATS.includes(value as GameFormat));
      if (valid.length) formats = [...new Set(valid)];
    }
  } catch {
    // Existing rows without valid format data remain available in both formats.
  }
  return {
    id: row.id,
    venueId: row.venue_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    pricePence: row.price_pence,
    capacity: row.capacity,
    bookedSpots: row.booked_spots,
    formats,
    status: row.status,
    description: row.description,
    descriptionZh: row.description_zh,
  };
}

function parseParticipants(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeBooking(row: BookingRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    participants: parseParticipants(row.participants_json),
    format: GAME_FORMATS.includes(row.format) ? row.format : 'singles',
    racketCount: row.racket_count,
    totalPence: row.total_pence,
    status: row.status,
    createdAt: row.created_at,
  };
}
