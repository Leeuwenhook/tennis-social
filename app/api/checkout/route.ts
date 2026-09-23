import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  expireStaleReservations,
  releaseBooking,
  type BookingRow,
} from '@/lib/server/database';
import { GAME_FORMATS, RACKET_PRICE_PENCE, type GameFormat } from '@/lib/demo-data';
import { createCheckoutSession } from '@/lib/server/stripe';
import { getAuthenticatedUser } from '@/lib/server/user-auth';

const LEVELS = new Set(['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0']);
type CheckoutInput = {
  sessionId?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  participants?: unknown;
  format?: unknown;
  racketCount?: unknown;
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseFormats(value: string): GameFormat[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((format): format is GameFormat => GAME_FORMATS.includes(format as GameFormat));
      if (valid.length) return [...new Set(valid)];
    }
  } catch {
    // A legacy or malformed value falls back to the original all-format behaviour.
  }
  return [...GAME_FORMATS];
}

function londonClock() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}:${values.second}`,
  };
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let input: CheckoutInput;
  try {
    input = await request.json() as CheckoutInput;
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  const sessionId = cleanString(input.sessionId, 120);
  const name = cleanString(input.name, 120);
  const email = cleanString(input.email, 254).toLowerCase();
  const phone = cleanString(input.phone, 40);
  const participants = Array.isArray(input.participants)
    ? input.participants.map((level) => typeof level === 'string' ? level : '')
    : [];
  const format = GAME_FORMATS.includes(input.format as GameFormat) ? input.format as GameFormat : '';
  const racketCount = Number(input.racketCount);
  if (
    !sessionId || !name || !/^\S+@\S+\.\S+$/.test(email) ||
    participants.length < 1 || participants.length > 8 || participants.some((level) => !LEVELS.has(level)) ||
    !format ||
    !Number.isInteger(racketCount) || racketCount < 0 || racketCount > participants.length
  ) {
    return Response.json({ error: 'invalid_booking' }, { status: 400 });
  }

  try {
    const db = database();
    await ensureSeeded(db);
    await expireStaleReservations(db);
    const authenticatedUser = await getAuthenticatedUser(request, db);

    const formatRows = await db`
      SELECT formats_json
      FROM sessions
      WHERE id = ${sessionId}
    ` as Array<{ formats_json: string }>;
    if (!formatRows[0]) return Response.json({ error: 'session_unavailable' }, { status: 409 });
    if (!parseFormats(formatRows[0].formats_json).includes(format)) {
      return Response.json({ error: 'format_unavailable' }, { status: 409 });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAtSeconds = Math.floor(now.getTime() / 1000) + 30 * 60;
    const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
    const clock = londonClock();
    const bookingId = `TS-${crypto.randomUUID()}`;

    // The conditional update and insert are one Postgres statement, so two
    // visitors cannot reserve the same last place at the same time.
    const rows = await db`
      WITH reserved AS (
        UPDATE sessions
        SET booked_spots = booked_spots + ${participants.length}, updated_at = ${nowIso}
        WHERE id = ${sessionId}
          AND status = 'published'
          AND (date > ${clock.date} OR (date = ${clock.date} AND end_time > ${clock.time}))
          AND booked_spots + ${participants.length} <= capacity
        RETURNING id, venue_id, price_pence
      )
      INSERT INTO bookings (
        id, session_id, user_id, contact_name, email, phone, participants_json,
        format, participant_count, racket_count, session_price_pence, racket_price_pence,
        total_pence, status, expires_at, created_at, updated_at
      )
      SELECT
        ${bookingId}, reserved.id, ${authenticatedUser?.id ?? null}, ${name}, ${email}, ${phone}, ${JSON.stringify(participants)},
        ${format}, ${participants.length}, ${racketCount}, reserved.price_pence, ${RACKET_PRICE_PENCE},
        reserved.price_pence * ${participants.length} + ${RACKET_PRICE_PENCE * racketCount},
        'pending_payment', ${expiresAt}, ${nowIso}, ${nowIso}
      FROM reserved
      RETURNING id, session_id, contact_name, email, phone, participants_json,
                format, participant_count, racket_count, session_price_pence, racket_price_pence,
                total_pence, status, stripe_checkout_session_id,
                stripe_payment_intent_id, checkout_url, expires_at, created_at, updated_at
    ` as BookingRow[];
    const booking = rows[0];
    if (!booking) return Response.json({ error: 'session_unavailable' }, { status: 409 });

    try {
      const venueRows = await db`
        SELECT venues.name AS venue_name
        FROM sessions
        LEFT JOIN venues ON venues.id = sessions.venue_id
        WHERE sessions.id = ${booking.session_id}
      ` as Array<{ venue_name: string | null }>;
      const checkout = await createCheckoutSession({
        bookingId: booking.id,
        sessionId: booking.session_id,
        format: booking.format,
        venueName: venueRows[0]?.venue_name ?? 'Tennis Social',
        participantCount: booking.participant_count,
        sessionPricePence: booking.session_price_pence,
        racketCount: booking.racket_count,
        racketPricePence: booking.racket_price_pence,
        email: booking.email,
        origin: new URL(request.url).origin,
        expiresAtSeconds,
      });
      if (!checkout.url) throw new Error('stripe_checkout_url_missing');
      await db`
        UPDATE bookings
        SET stripe_checkout_session_id = ${checkout.id}, checkout_url = ${checkout.url}, updated_at = ${new Date().toISOString()}
        WHERE id = ${booking.id} AND status = 'pending_payment'
      `;
      return Response.json({ bookingId: booking.id, checkoutUrl: checkout.url, expiresAt });
    } catch (error) {
      console.error('Unable to create Stripe Checkout Session', error);
      await releaseBooking(db, booking.id, 'payment_failed');
      const message = error instanceof Error && error.message === 'stripe_not_configured'
        ? 'stripe_not_configured'
        : 'payment_service_unavailable';
      return Response.json({ error: message }, { status: 503 });
    }
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to reserve places', error);
    return Response.json({ error: 'database_unavailable' }, { status: 503 });
  }
}
