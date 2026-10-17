import { sendAdminRequestNotification } from '@/lib/server/email';
import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { validatePartnerRequestApplication } from '@/lib/server/reservation-request-validation';
import { getAuthenticatedUser } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OpenRequestRow = {
  id: string;
  status: string;
  preferred_date: string;
  seeking_player_count: number;
  accepted_count: number;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: 'invalid_request' }, { status: 400 }); }
  const value = validatePartnerRequestApplication(body);
  if (!value) return Response.json({ error: 'invalid_request' }, { status: 400 });
  try {
    const db = database();
    const { id: requestId } = await context.params;
    const today = new Date().toISOString().slice(0, 10);
    const found = await db`
      SELECT requests.id, requests.status, requests.preferred_date, requests.seeking_player_count,
        (SELECT COUNT(*)::integer FROM partner_request_applications AS applications WHERE applications.request_id = requests.id AND applications.status = 'accepted') AS accepted_count
      FROM reservation_requests AS requests
      WHERE requests.id = ${requestId}
    ` as OpenRequestRow[];
    const target = found[0];
    if (!target) return Response.json({ error: 'not_found' }, { status: 404 });
    if (!['pending', 'reviewing'].includes(target.status) || target.preferred_date < today || target.seeking_player_count < 1) {
      return Response.json({ error: 'request_closed' }, { status: 409 });
    }
    if (target.accepted_count >= target.seeking_player_count) return Response.json({ error: 'request_full' }, { status: 409 });

    const user = await getAuthenticatedUser(request, db);
    const id = `application-${crypto.randomUUID()}`; const now = new Date().toISOString();
    // Re-check that the request is still open in the same statement so a concurrent close or fill is respected.
    const rows = await db`
      INSERT INTO partner_request_applications (id, request_id, user_id, name, email, phone, tennis_level, preferred_format, message, status, created_at, updated_at)
      SELECT ${id}, requests.id, ${user?.id ?? null}, ${value.name}, ${value.email}, ${value.phone}, ${value.tennisLevel}, ${value.preferredFormat}, ${value.message}, 'pending', ${now}, ${now}
      FROM reservation_requests AS requests
      WHERE requests.id = ${requestId}
        AND requests.status IN ('pending', 'reviewing')
        AND requests.preferred_date >= ${today}
        AND requests.seeking_player_count > (SELECT COUNT(*) FROM partner_request_applications AS applications WHERE applications.request_id = requests.id AND applications.status = 'accepted')
      RETURNING id, request_id, status, created_at
    ` as Array<{ id: string; request_id: string; status: string; created_at: string }>;
    if (!rows[0]) return Response.json({ error: 'request_closed' }, { status: 409 });
    await sendAdminRequestNotification('application', { id, ...value });
    return Response.json({ application: { id: rows[0].id, requestId: rows[0].request_id, status: rows[0].status, createdAt: rows[0].created_at } }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') return Response.json({ error: 'duplicate_application' }, { status: 409 });
    console.error('Unable to create partner request application', error);
    return Response.json({ error: 'application_unavailable' }, { status: 503 });
  }
}
