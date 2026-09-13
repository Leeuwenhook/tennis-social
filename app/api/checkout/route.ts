import { database, ensureSeeded, expireStaleReservations, type BookingRow, type SessionRow } from '@/lib/server/database';
import { createCheckoutSession } from '@/lib/server/stripe';

const LEVELS = new Set(['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0']);
const RACKET_PRICE_PENCE = 200;
const VENUE_NAMES: Record<string, string> = {
  'victoria-park': 'Victoria Park',
  'vauxhall-park': 'Vauxhall Park',
  'bethnal-green': 'Bethnal Green',
  'poplar-rec-ground': 'Poplar Rec Ground',
  'king-edward-memorial-park': 'King Edward Memorial Park',
};

type CheckoutInput = {
  sessionId?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  participants?: unknown;
  racketCount?: unknown;
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export const dynamic = 'force-dynamic';

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
    ? input.participants.filter((level): level is string => typeof level === 'string')
    : [];
  const racketCount = Number(input.racketCount);
  if (
    !sessionId || !name || !/^\S+@\S+\.\S+$/.test(email) ||
    participants.length < 1 || participants.length > 8 || participants.some((level) => !LEVELS.has(level)) ||
    !Number.isInteger(racketCount) || racketCount < 0 || racketCount > participants.length
  ) {
    return Response.json({ error: 'invalid_booking' }, { status: 400 });
  }

  const db = database();
  await ensureSeeded(db);
  await expireStaleReservations(db);
  const session = await db.prepare(`
    SELECT id, venue_id, date, start_time, end_time, price_pence, capacity,
           booked_spots, status, description, description_zh
    FROM sessions WHERE id = ?
  `).bind(sessionId).first<SessionRow>();
  if (!session || session.status !== 'published') {
    return Response.json({ error: 'session_unavailable' }, { status: 409 });
  }

  const bookingId = `TS-${crypto.randomUUID()}`;
  const now = new Date();
  const expiresAtSeconds = Math.floor(now.getTime() / 1000) + 30 * 60;
  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
  const totalPence = session.price_pence * participants.length + RACKET_PRICE_PENCE * racketCount;

  try {
    await db.prepare(`
      INSERT INTO bookings (
        id, session_id, contact_name, email, phone, participants_json,
        participant_count, racket_count, session_price_pence, racket_price_pence,
        total_pence, status, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?)
    `).bind(
      bookingId, session.id, name, email, phone, JSON.stringify(participants),
      participants.length, racketCount, session.price_pence, RACKET_PRICE_PENCE,
      totalPence, expiresAt, now.toISOString(), now.toISOString(),
    ).run();
  } catch (error) {
    console.error('Unable to reserve places', error);
    return Response.json({ error: 'not_enough_spots' }, { status: 409 });
  }

  try {
    const checkout = await createCheckoutSession({
      bookingId,
      sessionId: session.id,
      venueName: VENUE_NAMES[session.venue_id] ?? 'Tennis Social',
      participantCount: participants.length,
      sessionPricePence: session.price_pence,
      racketCount,
      racketPricePence: RACKET_PRICE_PENCE,
      email,
      origin: new URL(request.url).origin,
      expiresAtSeconds,
    });
    if (!checkout.url) throw new Error('stripe_checkout_url_missing');
    await db.prepare(`
      UPDATE bookings
      SET stripe_checkout_session_id = ?, checkout_url = ?, updated_at = ?
      WHERE id = ? AND status = 'pending_payment'
    `).bind(checkout.id, checkout.url, new Date().toISOString(), bookingId).run();
    return Response.json({ bookingId, checkoutUrl: checkout.url, expiresAt });
  } catch (error) {
    console.error('Unable to create Stripe Checkout Session', error);
    await db.prepare(`
      UPDATE bookings SET status = 'payment_failed', updated_at = ?
      WHERE id = ? AND status = 'pending_payment'
    `).bind(new Date().toISOString(), bookingId).run();
    const message = error instanceof Error && error.message === 'stripe_not_configured'
      ? 'stripe_not_configured'
      : 'payment_service_unavailable';
    return Response.json({ error: message }, { status: 503 });
  }
}
