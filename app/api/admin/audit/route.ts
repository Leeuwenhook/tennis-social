import { requireAdmin } from '@/lib/server/admin-auth';
import { listAuditLog } from '@/lib/server/audit-log';
import { database, DatabaseNotConfiguredError } from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    return Response.json(await listAuditLog(database(), new URL(request.url).searchParams));
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to load the admin audit log');
    return Response.json({ error: 'audit_unavailable' }, { status: 503 });
  }
}
