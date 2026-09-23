import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import {
  createUserSession,
  hashPassword,
  normalizeUserProfileInput,
  serializeUser,
  userSessionCookie,
} from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try {
    input = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const password = typeof input.password === 'string' ? input.password : '';
  const profile = normalizeUserProfileInput(input);
  if (
    !profile || password.length < 8 || password.length > 128
  ) {
    return Response.json({ error: 'invalid_registration' }, { status: 400 });
  }
  try {
    const db = database();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const rows = await db`
      INSERT INTO users (
        id, name, email, phone, password_hash, postcode, tennis_level,
        preferred_time, preferred_format, created_at, updated_at
      ) VALUES (
        ${id}, ${profile.name}, ${profile.email}, ${profile.phone}, ${passwordHash}, ${profile.postcode}, ${profile.tennisLevel},
        ${profile.preferredTime}, ${profile.preferredFormat}, ${now}, ${now}
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name, email, phone, password_hash, postcode, tennis_level, preferred_time, preferred_format
    ` as Parameters<typeof serializeUser>[0][];
    if (!rows[0]) return Response.json({ error: 'email_exists' }, { status: 409 });
    const token = await createUserSession(db, id);
    return Response.json(
      { user: serializeUser(rows[0]) },
      { status: 201, headers: { 'Set-Cookie': userSessionCookie(token) } },
    );
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to register user', error);
    return Response.json({ error: 'registration_unavailable' }, { status: 503 });
  }
}
