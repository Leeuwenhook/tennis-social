import { auditedMutation } from '@/lib/server/audit-log';
import { requireAdmin } from '@/lib/server/admin-auth';
import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeVenue,
  type VenueRow,
} from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function parseBody(request: Request) {
  try {
    return (await request.json()) as { archived?: unknown } | null;
  } catch {
    return null;
  }
}

/** Archived venues keep their past sessions and requests but are hidden from new sessions. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const input = await parseBody(request);
  if (typeof input?.archived !== 'boolean')
    return Response.json({ error: 'invalid_archive' }, { status: 400 });
  const archived = input.archived;
  try {
    const db = database();
    await ensureSeeded(db);
    const existingRows = (await db`SELECT id, name FROM venues WHERE id = ${id}`) as Array<{ id: string; name: string }>;
    if (!existingRows[0]) return Response.json({ error: 'venue_not_found' }, { status: 404 });
    const now = new Date().toISOString();
    const rows = (await auditedMutation(db, request, { action: archived ? 'venue.archive' : 'venue.restore', targetType: 'venue', targetId: id, summary: existingRows[0].name })`
      UPDATE venues
      SET archived_at = ${archived ? now : null}, updated_at = ${now}
      WHERE id = ${id}
      RETURNING id, name, name_zh, area, area_zh, photo, notes, description, description_zh,
                peak_price_pence, off_peak_price_pence, photos_json, address, postcode, court_count, court_setting, floodlights, free_cancellation_hours, archived_at, created_at, updated_at
    `) as VenueRow[];
    if (!rows[0]) return Response.json({ error: 'venue_not_found' }, { status: 404 });
    return Response.json({ venue: serializeVenue(rows[0]) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to archive venue', error);
    return Response.json({ error: 'venue_unavailable' }, { status: 503 });
  }
}
