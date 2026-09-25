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
  coupon_id: string | null;
  coupon_discount_pence: number;
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

export type CouponRow = {
  id: string;
  user_id: string;
  code: string;
  discount_percent: number;
  milestone_count: number;
  issued_at: string;
  expires_at: string;
  status: 'available' | 'reserved' | 'redeemed' | 'expired';
  reserved_booking_id: string | null;
  redeemed_booking_id: string | null;
  redeemed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function serializeCoupon(row: CouponRow) {
  return {
    id: row.id,
    code: row.code,
    discountPercent: row.discount_percent,
    milestoneCount: row.milestone_count,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status: row.status,
    redeemedAt: row.redeemed_at,
  };
}

export type LoyaltyStatus = {
  participationCount: number;
  nextRewardAt: number;
  coupons: ReturnType<typeof serializeCoupon>[];
};

export type ReservationRequestRow = {
  id: string;
  venue_id: string | null;
  venue_name: string;
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
      coupon_discount_pence, total_pence, status, expires_at, created_at, updated_at
    ) VALUES (
      ${booking.id}, ${booking.sessionId}, ${booking.contactName}, ${booking.email}, ${booking.phone},
      ${JSON.stringify(booking.participants)}, ${booking.format}, ${booking.participants.length}, ${booking.racketCount},
      ${booking.totalPence - booking.racketCount * RACKET_PRICE_PENCE}, ${RACKET_PRICE_PENCE}, 0, ${booking.totalPence}, ${booking.status},
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
    venueName: row.venue_name,
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
      RETURNING id, session_id, participant_count, coupon_id
    ), released_coupons AS (
      UPDATE coupons AS coupons
      SET status = CASE WHEN coupons.expires_at <= ${now} THEN 'expired' ELSE 'available' END,
          reserved_booking_id = NULL,
          updated_at = ${now}
      FROM expired
      WHERE coupons.id = expired.coupon_id
        AND coupons.status = 'reserved'
        AND coupons.reserved_booking_id = expired.id
      RETURNING coupons.id
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
      RETURNING id, session_id, participant_count, coupon_id
    ), released_coupon AS (
      UPDATE coupons AS coupons
      SET status = CASE WHEN coupons.expires_at <= ${now} THEN 'expired' ELSE 'available' END,
          reserved_booking_id = NULL,
          updated_at = ${now}
      FROM released
      WHERE coupons.id = released.coupon_id
        AND coupons.status = 'reserved'
        AND coupons.reserved_booking_id = released.id
      RETURNING coupons.id
    )
    UPDATE sessions AS sessions
    SET booked_spots = GREATEST(0, sessions.booked_spots - released.participant_count),
        updated_at = ${now}
    FROM released
    WHERE sessions.id = released.session_id
  `;
}

export async function confirmBooking(
  db: Database,
  bookingId: string,
  checkoutSessionId: string,
  paymentIntentId: string | null,
) {
  const now = new Date().toISOString();
  const rows = await db`
    UPDATE bookings
    SET status = 'confirmed',
        stripe_payment_intent_id = ${paymentIntentId},
        updated_at = ${now}
    WHERE id = ${bookingId}
      AND stripe_checkout_session_id = ${checkoutSessionId}
      AND status = 'pending_payment'
    RETURNING *
  ` as BookingRow[];
  if (rows[0]) {
    await db`
      UPDATE coupons
      SET status = 'redeemed',
          reserved_booking_id = NULL,
          redeemed_booking_id = ${bookingId},
          redeemed_at = ${now},
          updated_at = ${now}
      WHERE reserved_booking_id = ${bookingId}
        AND status = 'reserved'
    `;
  }
  return rows[0] ?? null;
}

function couponExpiry(issuedAt: string) {
  const expiresAt = new Date(issuedAt);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 3);
  return expiresAt.toISOString();
}

export async function awardLoyaltyCoupons(db: Database, userId: string) {
  const countRows = await db`
    SELECT COUNT(*)::integer AS participation_count
    FROM bookings
    WHERE user_id = ${userId} AND status = 'confirmed'
  ` as Array<{ participation_count: number }>;
  const participationCount = Number(countRows[0]?.participation_count ?? 0);
  const earnedMilestones = Math.floor(participationCount / 10);
  if (earnedMilestones < 1) return participationCount;

  const issuedAt = new Date().toISOString();
  for (let milestoneCount = 10; milestoneCount <= earnedMilestones * 10; milestoneCount += 10) {
    const id = `CP-${crypto.randomUUID()}`;
    const code = `HALF-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
    await db`
      INSERT INTO coupons (
        id, user_id, code, discount_percent, milestone_count, issued_at, expires_at,
        status, created_at, updated_at
      ) VALUES (
        ${id}, ${userId}, ${code}, 50, ${milestoneCount}, ${issuedAt}, ${couponExpiry(issuedAt)},
        'available', ${issuedAt}, ${issuedAt}
      )
      ON CONFLICT (user_id, milestone_count) DO NOTHING
    `;
  }
  return participationCount;
}

export async function getLoyaltyStatus(db: Database, userId: string): Promise<LoyaltyStatus> {
  const participationCount = await awardLoyaltyCoupons(db, userId);
  const now = new Date().toISOString();
  await db`
    UPDATE coupons
    SET status = 'expired', updated_at = ${now}
    WHERE user_id = ${userId}
      AND status = 'available'
      AND expires_at <= ${now}
  `;
  const rows = await db`
    SELECT id, user_id, code, discount_percent, milestone_count, issued_at, expires_at,
           status, reserved_booking_id, redeemed_booking_id, redeemed_at, created_at, updated_at
    FROM coupons
    WHERE user_id = ${userId}
    ORDER BY milestone_count DESC, issued_at DESC
  ` as CouponRow[];
  return {
    participationCount,
    nextRewardAt: (Math.floor(participationCount / 10) + 1) * 10,
    coupons: rows.map(serializeCoupon),
  };
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
    couponId: row.coupon_id,
    couponDiscountPence: row.coupon_discount_pence,
    totalPence: row.total_pence,
    status: row.status,
    createdAt: row.created_at,
  };
}
