import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import {
  createUserSession,
  hashPassword,
  PREFERRED_FORMATS,
  PREFERRED_TIMES,
  serializeUser,
  TENNIS_LEVELS,
  userSessionCookie,
} from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clean(value: unknown, length: number) {
  return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try {
    input = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const name = clean(input.name, 120);
  const email = clean(input.email, 254).toLowerCase();
  const phone = clean(input.phone, 40);
  const postcode = clean(input.postcode, 12).toUpperCase().replace(/\s+/g, ' ');
  const password = typeof input.password === 'string' ? input.password : '';
  const tennisLevel = clean(input.tennisLevel, 8);
  const preferredTime = clean(input.preferredTime, 30);
  const preferredFormat = clean(input.preferredFormat, 20);
  if (
    !name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128 ||
    !/^[A-Z0-9 ]{2,12}$/.test(postcode) || !TENNIS_LEVELS.includes(tennisLevel as never) ||
    !PREFERRED_TIMES.includes(preferredTime as never) || !PREFERRED_FORMATS.includes(preferredFormat as never)
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
        ${id}, ${name}, ${email}, ${phone}, ${passwordHash}, ${postcode}, ${tennisLevel},
        ${preferredTime}, ${preferredFormat}, ${now}, ${now}
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
