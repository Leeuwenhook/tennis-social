import {
  adminSessionCookie,
  areAdminCredentialsValid,
  createAdminSession,
  requireSameOrigin,
} from '@/lib/server/admin-auth';
import { clientIp, hashIp, checkAndRecordLoginAttempt } from '@/lib/server/admin-login-guard';
import { database, DatabaseNotConfiguredError, type Database } from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  let input: { username?: unknown; password?: unknown };
  try {
    input = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (!input || typeof input !== 'object') {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const username =
    typeof input.username === 'string'
      ? input.username.trim().slice(0, 120)
      : '';
  const password = typeof input.password === 'string' ? input.password : '';
  // Without a database (local demo mode) logins are not rate limited.
  let db: Database | null = null;
  const ipHash = hashIp(clientIp(request));
  try {
    db = database();
  } catch (error) {
    if (!(error instanceof DatabaseNotConfiguredError)) throw error;
  }
  if (!db && process.env.NODE_ENV === 'production') return Response.json({ error: 'login_unavailable' }, { status: 503 });
  const valid = areAdminCredentialsValid(username, password);
  if (db) {
    try {
      if (await checkAndRecordLoginAttempt(db, username, ipHash, valid)) {
        return Response.json({ error: 'too_many_attempts' }, { status: 429 });
      }
    } catch {
      console.error('Unable to apply admin login guard');
      return Response.json({ error: 'login_unavailable' }, { status: 503 });
    }
  }
  if (!valid) {
    return Response.json({ error: 'invalid_credentials' }, { status: 401 });
  }
  return Response.json(
    { authenticated: true },
    {
      headers: {
        'Set-Cookie': adminSessionCookie(createAdminSession(username)),
      },
    },
  );
}
