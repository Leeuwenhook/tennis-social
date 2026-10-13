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
    if (body.status === 'accepted') {
      const found = await db`
        SELECT requests.status, requests.seeking_player_count,
          (SELECT COUNT(*)::integer FROM partner_request_applications AS applications
            WHERE applications.request_id = requests.id AND applications.status = 'accepted' AND applications.id <> ${applicationId}) AS accepted_count
        FROM reservation_requests AS requests
        WHERE requests.id = ${requestId}
      ` as Array<{ status: string; seeking_player_count: number; accepted_count: number }>;
      const target = found[0];
      if (!target) return Response.json({ error: 'not_found' }, { status: 404 });
      if (target.status === 'completed' || target.status === 'cancelled') return Response.json({ error: 'request_closed' }, { status: 409 });
      if (target.accepted_count >= target.seeking_player_count) return Response.json({ error: 'request_full' }, { status: 409 });
    }
    // Accepting re-checks capacity in the same statement so two concurrent accepts cannot overfill the request.
    const rows = await db`
      UPDATE partner_request_applications SET status = ${body.status}, updated_at = ${now}
      WHERE id = ${applicationId} AND request_id = ${requestId}
        AND (${body.status} <> 'accepted' OR (
          SELECT requests.seeking_player_count FROM reservation_requests AS requests WHERE requests.id = ${requestId}
        ) > (
          SELECT COUNT(*) FROM partner_request_applications AS applications
          WHERE applications.request_id = ${requestId} AND applications.status = 'accepted' AND applications.id <> ${applicationId}
        ))
      RETURNING *
    ` as Array<Record<string, unknown>>;
    if (!rows[0]) return Response.json({ error: body.status === 'accepted' ? 'request_full' : 'not_found' }, { status: body.status === 'accepted' ? 409 : 404 });
    return Response.json({ application: rows[0] });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to update partner request application', error); return Response.json({ error: 'application_unavailable' }, { status: 503 });
  }
}
