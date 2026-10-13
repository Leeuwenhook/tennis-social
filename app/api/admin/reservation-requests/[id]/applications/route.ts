import { requireAdmin } from '@/lib/server/admin-auth';
import { database, DatabaseNotConfiguredError } from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  try {
    const db = database(); const { id } = await context.params;
    const rows = await db`SELECT * FROM partner_request_applications WHERE request_id = ${id} ORDER BY created_at DESC` as Array<Record<string, unknown>>;
    return Response.json({ applications: rows });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to load partner request applications', error); return Response.json({ error: 'applications_unavailable' }, { status: 503 });
  }
}
