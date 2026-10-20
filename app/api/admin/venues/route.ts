import { auditedMutation } from '@/lib/server/audit-log';
import { requireAdmin } from '@/lib/server/admin-auth';
import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeVenue,
  type VenueRow,
} from '@/lib/server/database';
import {
  validateVenueInput,
  venueInputIssues,
  type VenueInput,
} from '@/lib/server/admin-validation';
import { londonDate } from '@/lib/server/london-time';

type VenueCountRow = VenueRow & { session_count: number; future_session_count: number; request_count: number };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function parseBody(request: Request) {
  try {
    return (await request.json()) as VenueInput;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = database();
    await ensureSeeded(db);
    const today = londonDate(new Date());
    const rows = (await db`
      SELECT v.id, v.name, v.name_zh, v.area, v.area_zh, v.photo, v.notes, v.description, v.description_zh,
             v.peak_price_pence, v.off_peak_price_pence, v.photos_json, v.address, v.address_zh, v.postcode,
             v.court_count, v.court_setting, v.floodlights, v.archived_at, v.created_at, v.updated_at,
             COALESCE(s.session_count, 0)::integer AS session_count,
             COALESCE(s.future_session_count, 0)::integer AS future_session_count,
             COALESCE(r.request_count, 0)::integer AS request_count
      FROM venues v
      LEFT JOIN (
        SELECT venue_id, COUNT(*) AS session_count, COUNT(*) FILTER (WHERE date >= ${today}) AS future_session_count
        FROM sessions GROUP BY venue_id
      ) s ON s.venue_id = v.id
      LEFT JOIN (
        SELECT venue_id, COUNT(*) AS request_count FROM reservation_requests GROUP BY venue_id
      ) r ON r.venue_id = v.id
      ORDER BY v.name, v.id
    `) as VenueCountRow[];
    return Response.json({
      venues: rows.map((row) => ({
        ...serializeVenue(row),
        sessionCount: Number(row.session_count) || 0,
        futureSessionCount: Number(row.future_session_count) || 0,
        requestCount: Number(row.request_count) || 0,
      })),
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json(
        { error: 'database_not_configured' },
        { status: 503 },
      );
    }
    console.error('Unable to load admin venues', error);
    return Response.json({ error: 'venues_unavailable' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const input = await parseBody(request);
  try {
    const db = database();
    await ensureSeeded(db);
    const issues = input ? venueInputIssues(input) : null;
    const venue = input && !issues?.length ? validateVenueInput(input) : null;
    if (!venue)
      return Response.json({ error: 'invalid_venue', issues: issues ?? [] }, { status: 400 });
    const now = new Date().toISOString();
    const id = `venue-${crypto.randomUUID()}`;
    const rows = (await auditedMutation(db, request, { action: 'venue.create', targetType: 'venue', targetId: id, summary: venue.name })`
      INSERT INTO venues (
        id, name, name_zh, area, area_zh, photo, notes, description, description_zh, peak_price_pence,
        off_peak_price_pence, photos_json, address, address_zh, postcode, court_count, court_setting, floodlights, archived_at, created_at, updated_at
      ) VALUES (
        ${id}, ${venue.name}, ${venue.nameZh}, ${venue.area}, ${venue.areaZh}, ${venue.photo}, ${venue.notes}, ${venue.description}, ${venue.descriptionZh},
        ${venue.peakPricePence}, ${venue.offPeakPricePence}, ${JSON.stringify(venue.photos)}, ${venue.address}, ${venue.addressZh}, ${venue.postcode},
        ${venue.courtCount}, ${venue.courtSetting}, ${venue.floodlights}, NULL, ${now}, ${now}
      )
      RETURNING id, name, name_zh, area, area_zh, photo, notes, description, description_zh,
                peak_price_pence, off_peak_price_pence, photos_json, address, address_zh, postcode, court_count, court_setting, floodlights, archived_at, created_at, updated_at
    `) as VenueRow[];
    return Response.json({ venue: serializeVenue(rows[0]) }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json(
        { error: 'database_not_configured' },
        { status: 503 },
      );
    }
    console.error('Unable to create venue', error);
    return Response.json({ error: 'venue_unavailable' }, { status: 503 });
  }
}
