import { venues as fallbackVenues } from '@/lib/demo-data';
import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeVenue,
  type VenueRow,
} from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = database();
    await ensureSeeded(db);
    const rows = (await db`
      SELECT id, name, name_zh, area, area_zh, photo,
             peak_price_pence, off_peak_price_pence, created_at, updated_at
      FROM venues
      ORDER BY name, id
    `) as VenueRow[];
    return Response.json({
      venues: rows.map(serializeVenue),
      source: 'database',
    });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfiguredError)) {
      console.error('Unable to load venues', error);
    }
    return Response.json({ venues: fallbackVenues, source: 'fallback' });
  }
}
