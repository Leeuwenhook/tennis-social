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
  type VenueInput,
} from '@/lib/server/admin-validation';

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
    const rows = (await db`
      SELECT id, name, name_zh, area, area_zh, photo,
             peak_price_pence, off_peak_price_pence, created_at, updated_at
      FROM venues
      ORDER BY name, id
    `) as VenueRow[];
    return Response.json({ venues: rows.map(serializeVenue) });
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
    const venue = input ? validateVenueInput(input) : null;
    if (!venue)
      return Response.json({ error: 'invalid_venue' }, { status: 400 });
    const now = new Date().toISOString();
    const id = `venue-${crypto.randomUUID()}`;
    const rows = (await db`
      INSERT INTO venues (
        id, name, name_zh, area, area_zh, photo, peak_price_pence,
        off_peak_price_pence, created_at, updated_at
      ) VALUES (
        ${id}, ${venue.name}, ${venue.nameZh}, ${venue.area}, ${venue.areaZh}, ${venue.photo},
        ${venue.peakPricePence}, ${venue.offPeakPricePence}, ${now}, ${now}
      )
      RETURNING id, name, name_zh, area, area_zh, photo,
                peak_price_pence, off_peak_price_pence, created_at, updated_at
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
