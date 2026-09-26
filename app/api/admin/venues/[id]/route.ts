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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const input = await parseBody(request);
  try {
    const db = database();
    await ensureSeeded(db);
    const venue = input ? validateVenueInput(input) : null;
    if (!venue)
      return Response.json({ error: 'invalid_venue' }, { status: 400 });
    const now = new Date().toISOString();
    const rows = (await db`
      UPDATE venues
      SET name = ${venue.name}, name_zh = ${venue.nameZh}, area = ${venue.area},
          area_zh = ${venue.areaZh}, photo = ${venue.photo},
          peak_price_pence = ${venue.peakPricePence},
          off_peak_price_pence = ${venue.offPeakPricePence}, updated_at = ${now}
      WHERE id = ${id}
      RETURNING id, name, name_zh, area, area_zh, photo,
                peak_price_pence, off_peak_price_pence, created_at, updated_at
    `) as VenueRow[];
    if (!rows[0])
      return Response.json({ error: 'venue_not_found' }, { status: 404 });
    return Response.json({ venue: serializeVenue(rows[0]) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json(
        { error: 'database_not_configured' },
        { status: 503 },
      );
    }
    console.error('Unable to update venue', error);
    return Response.json({ error: 'venue_unavailable' }, { status: 503 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;

  try {
    const db = database();
    await ensureSeeded(db);
    const existingRows = await db`
      SELECT id
      FROM venues
      WHERE id = ${id}
    ` as Array<{ id: string }>;
    if (!existingRows[0]) return Response.json({ error: 'venue_not_found' }, { status: 404 });

    const sessionRows = await db`
      SELECT COUNT(*)::integer AS session_count
      FROM sessions
      WHERE venue_id = ${id}
    ` as Array<{ session_count: number }>;
    const requestRows = await db`
      SELECT COUNT(*)::integer AS request_count
      FROM reservation_requests
      WHERE venue_id = ${id}
    ` as Array<{ request_count: number }>;
    if ((sessionRows[0]?.session_count ?? 0) > 0 || (requestRows[0]?.request_count ?? 0) > 0) {
      return Response.json({ error: 'venue_in_use' }, { status: 409 });
    }

    const deletedRows = await db`
      DELETE FROM venues
      WHERE id = ${id}
      RETURNING id
    ` as Array<{ id: string }>;
    if (!deletedRows[0]) return Response.json({ error: 'venue_not_found' }, { status: 404 });
    return Response.json({ id: deletedRows[0].id });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to delete venue', error);
    return Response.json({ error: 'venue_unavailable' }, { status: 503 });
  }
}
