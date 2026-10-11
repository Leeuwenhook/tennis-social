import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { validatePartnerRequestApplication } from '@/lib/server/reservation-request-validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: 'invalid_request' }, { status: 400 }); }
  const value = validatePartnerRequestApplication(body);
  if (!value) return Response.json({ error: 'invalid_request' }, { status: 400 });
  try {
    const db = database();
    const { id: requestId } = await context.params;
    const open = await db`SELECT id FROM reservation_requests WHERE id = ${requestId} AND status IN ('pending', 'reviewing')` as Array<{ id: string }>;
    if (!open[0]) return Response.json({ error: 'request_closed' }, { status: 409 });
    const id = `application-${crypto.randomUUID()}`; const now = new Date().toISOString();
    const rows = await db`
      INSERT INTO partner_request_applications (id, request_id, name, email, phone, tennis_level, preferred_format, can_attend_full_duration, message, status, created_at, updated_at)
      VALUES (${id}, ${requestId}, ${value.name}, ${value.email}, ${value.phone}, ${value.tennisLevel}, ${value.preferredFormat}, ${value.canAttendFullDuration}, ${value.message}, 'pending', ${now}, ${now})
      RETURNING id, request_id, status, created_at
    ` as Array<{ id: string; request_id: string; status: string; created_at: string }>;
    return Response.json({ application: { id: rows[0].id, requestId: rows[0].request_id, status: rows[0].status, createdAt: rows[0].created_at } }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') return Response.json({ error: 'duplicate_application' }, { status: 409 });
    console.error('Unable to create partner request application', error);
    return Response.json({ error: 'application_unavailable' }, { status: 503 });
  }
}
