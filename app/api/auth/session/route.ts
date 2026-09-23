import { DatabaseNotConfiguredError } from '@/lib/server/database';
import { getAuthenticatedUser, serializeUser } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    return user
      ? Response.json({ user: serializeUser(user) })
      : Response.json({ error: 'unauthenticated' }, { status: 401 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to read user session', error);
    return Response.json({ error: 'session_unavailable' }, { status: 503 });
  }
}
