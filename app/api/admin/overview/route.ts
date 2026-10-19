import { requireAdmin } from '@/lib/server/admin-auth';
import { loadAdminOverview } from '@/lib/server/admin-overview';
import { database, DatabaseNotConfiguredError, expireStaleReservations } from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = database();
    await expireStaleReservations(db);
    return Response.json(await loadAdminOverview(db));
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to load admin overview');
    return Response.json({ error: 'overview_unavailable' }, { status: 503 });
  }
}
