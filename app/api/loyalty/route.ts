import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  getLoyaltyStatus,
} from '@/lib/server/database';
import { getAuthenticatedUser } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const db = database();
    await ensureSeeded(db);
    const user = await getAuthenticatedUser(request, db);
    if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
    const loyalty = await getLoyaltyStatus(db, user.id);
    return Response.json({ loyalty });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to load loyalty status', error);
    return Response.json({ error: 'loyalty_unavailable' }, { status: 503 });
  }
}
