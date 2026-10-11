import { requireAdmin } from '@/lib/server/admin-auth';
import { database, DatabaseNotConfiguredError } from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, context: { params: Promise<{ id: string; applicationId: string }> }) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  let body: { status?: unknown }; try { body = await request.json() as { status?: unknown }; } catch { return Response.json({ error: 'invalid_request' }, { status: 400 }); }
  if (!['pending', 'accepted', 'rejected'].includes(body.status as string)) return Response.json({ error: 'invalid_status' }, { status: 400 });
  try {
    const db = database(); const { id: requestId, applicationId } = await context.params; const now = new Date().toISOString();
    const rows = await db`UPDATE partner_request_applications SET status = ${body.status}, updated_at = ${now} WHERE id = ${applicationId} AND request_id = ${requestId} RETURNING *`;
    if (!rows[0]) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ application: rows[0] });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to update partner request application', error); return Response.json({ error: 'application_unavailable' }, { status: 503 });
  }
}
