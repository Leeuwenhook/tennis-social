import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { createUserSession, serializeUser, userSessionCookie, verifyPassword } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let input: { email?: unknown; password?: unknown };
  try {
    input = await request.json() as { email?: unknown; password?: unknown };
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const email = typeof input.email === 'string' ? input.email.trim().slice(0, 254).toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  try {
    const db = database();
    const rows = await db`
      SELECT id, name, email, phone, password_hash, postcode, tennis_level, preferred_time, preferred_format
      FROM users WHERE email = ${email} LIMIT 1
    ` as Array<Parameters<typeof serializeUser>[0]>;
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return Response.json({ error: 'invalid_credentials' }, { status: 401 });
    }
    const token = await createUserSession(db, user.id);
    return Response.json(
      { user: serializeUser(user) },
      { headers: { 'Set-Cookie': userSessionCookie(token) } },
    );
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to sign in user', error);
    return Response.json({ error: 'login_unavailable' }, { status: 503 });
  }
}
