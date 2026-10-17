import { sendAdminRequestNotification } from '@/lib/server/email';
import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeReservationRequest,
  serializePublicReservationRequest,
  type ReservationRequestRow,
} from '@/lib/server/database';
import {
  validateReservationRequest,
  type ReservationRequestInput,
} from '@/lib/server/reservation-request-validation';
import { TENNIS_LEVELS } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const db = database(); await ensureSeeded(db);
    const params = new URL(request.url).searchParams;
    const today = new Date().toISOString().slice(0, 10);
    const postcode = params.get('postcode')?.trim() || null;
    const area = params.get('area')?.trim() || null;
    const dateParam = params.get('date') || '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
    const formatParam = params.get('format') || '';
    const format = ['singles', 'doubles', 'practice', 'flexible'].includes(formatParam) ? formatParam : null;
    const levelParam = params.get('level') || '';
    const level = TENNIS_LEVELS.includes(levelParam as never) ? JSON.stringify([levelParam]) : null;
    const rows = await db`
      SELECT requests.*, venues.area
      FROM reservation_requests AS requests LEFT JOIN venues ON venues.id = requests.venue_id
      WHERE requests.status IN ('pending', 'reviewing')
        AND requests.preferred_date >= ${today}
        AND requests.seeking_player_count > 0
        AND (${postcode}::text IS NULL OR requests.postcode ILIKE ${`%${postcode ?? ''}%`})
        AND (${area}::text IS NULL OR venues.area ILIKE ${`%${area ?? ''}%`})
        AND (${date}::text IS NULL OR requests.preferred_date = ${date})
        AND (${format}::text IS NULL OR requests.preferred_format = ${format})
        AND (${level}::text IS NULL OR requests.existing_player_levels_json::jsonb @> ${level}::jsonb OR requests.seeking_levels_json::jsonb @> ${level}::jsonb)
      ORDER BY requests.preferred_date, requests.start_time
    ` as Array<ReservationRequestRow & { area: string | null }>;
    return Response.json({ requests: rows.map(serializePublicReservationRequest) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to load public reservation requests', error);
    return Response.json({ error: 'requests_unavailable' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let input: ReservationRequestInput;
  try {
    input = await request.json() as ReservationRequestInput;
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const db = database();
    await ensureSeeded(db);
    const venueRows = await db`
      SELECT id, name, name_zh, area, area_zh
      FROM venues
    ` as Array<{ id: string; name: string; name_zh: string; area: string; area_zh: string }>;
    const value = validateReservationRequest(input, venueRows.map((venue) => ({
      id: venue.id,
      name: venue.name,
      nameZh: venue.name_zh,
      area: venue.area,
      areaZh: venue.area_zh,
    })));
    if (!value) return Response.json({ error: 'invalid_request' }, { status: 400 });

    const id = `request-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const rows = await db`
      INSERT INTO reservation_requests (
        id, request_type, venue_id, venue_name, postcode, preferred_date, start_time, end_time, contact_name,
        email, phone, message, status, created_at, updated_at
        , request_kind, venue_booking_status, existing_player_levels_json, seeking_player_count, seeking_levels_json, preferred_format, budget_pence
      ) VALUES (
        ${id}, ${value.requestType}, ${value.venueId}, ${value.venueName}, ${value.postcode}, ${value.preferredDate}, ${value.startTime}, ${value.endTime},
        ${value.contactName}, ${value.email}, ${value.phone}, ${value.message}, 'pending', ${now}, ${now}, ${value.requestKind}, ${value.venueBookingStatus}, ${JSON.stringify(value.existingPlayerLevels)}, ${value.seekingPlayerCount}, ${JSON.stringify(value.seekingLevels)}, ${value.preferredFormat}, ${value.budgetPence}
      )
      RETURNING *
    ` as ReservationRequestRow[];
    await sendAdminRequestNotification('request', { id, ...value });
    return Response.json({ request: serializeReservationRequest(rows[0]) }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to create reservation request', error);
    return Response.json({ error: 'request_unavailable' }, { status: 503 });
  }
}
