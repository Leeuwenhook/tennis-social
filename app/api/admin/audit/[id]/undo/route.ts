import { requireAdmin } from '@/lib/server/admin-auth';
import { undoAdminAction } from '@/lib/server/audit-log';
import { database, DatabaseNotConfiguredError } from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS_CODES: Record<string, number> = {
  undone: 200,
  not_found: 404,
  not_undoable: 400,
  already_undone: 409,
  changed_since: 409,
  locked_fields: 409,
  capacity_too_low: 409,
  has_bookings: 409,
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  try {
    const result = await undoAdminAction(database(), request, id);
    return Response.json(result.status === 'undone' ? { undone: true } : { error: result.status }, { status: STATUS_CODES[result.status] });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to undo admin action');
    return Response.json({ error: 'undo_unavailable' }, { status: 503 });
  }
}
