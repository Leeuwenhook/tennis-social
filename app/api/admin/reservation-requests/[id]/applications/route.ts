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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  let body: { status?: unknown }; try { body = await request.json() as { status?: unknown }; } catch { return Response.json({ error: 'invalid_request' }, { status: 400 }); }
  if (body.status !== 'pending' && body.status !== 'accepted' && body.status !== 'rejected') return Response.json({ error: 'invalid_status' }, { status: 400 });
  try {
    const db = database(); const { id } = await context.params; const now = new Date().toISOString();
    const rows = await db`UPDATE partner_request_applications SET status = ${body.status}, updated_at = ${now} WHERE id = ${id} RETURNING *` as Array<Record<string, unknown>>;
    if (!rows[0]) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ application: rows[0] });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to update partner request application', error); return Response.json({ error: 'application_unavailable' }, { status: 503 });
  }
}
