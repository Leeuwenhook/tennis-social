import { getRuntimeEnv } from './runtime';
import { seededServerSessions } from './seed';

export type SessionRow = {
  id: string;
  venue_id: string;
  date: string;
  start_time: string;
  end_time: string;
  price_pence: number;
  capacity: number;
  booked_spots: number;
  status: 'published' | 'draft';
  description: string;
  description_zh: string;
};

export type BookingRow = {
  id: string;
  session_id: string;
  contact_name: string;
  email: string;
  phone: string;
  participants_json: string;
  participant_count: number;
  racket_count: number;
  session_price_pence: number;
  racket_price_pence: number;
  total_pence: number;
  status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export function database() {
  return getRuntimeEnv().DB;
}

export async function ensureSeeded(db = database()) {
  const now = new Date().toISOString();
  const statements = seededServerSessions.map((session) =>
    db.prepare(`
      INSERT OR IGNORE INTO sessions (
        id, venue_id, date, start_time, end_time, price_pence, capacity,
        booked_spots, status, description, description_zh, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)
    `).bind(...session, now, now),
  );
  await db.batch(statements);
}

export async function expireStaleReservations(db = database()) {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE bookings
    SET status = 'expired', updated_at = ?
    WHERE status = 'pending_payment' AND expires_at IS NOT NULL AND expires_at < ?
  `).bind(now, now).run();
}

export function serializeSession(row: SessionRow) {
  return {
    id: row.id,
    venueId: row.venue_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    pricePence: row.price_pence,
    capacity: row.capacity,
    bookedSpots: row.booked_spots,
    status: row.status,
    description: row.description,
    descriptionZh: row.description_zh,
  };
}

export function serializeBooking(row: BookingRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    participants: JSON.parse(row.participants_json) as string[],
    racketCount: row.racket_count,
    totalPence: row.total_pence,
    status: row.status,
    createdAt: row.created_at,
  };
}
