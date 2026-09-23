import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import {
  getAuthenticatedUser,
  normalizeUserProfileInput,
  serializeUser,
} from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request) {
  let input: Record<string, unknown>;
  try {
    input = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const profile = normalizeUserProfileInput(input);
  if (!profile) return Response.json({ error: 'invalid_profile' }, { status: 400 });

  try {
    const db = database();
    const currentUser = await getAuthenticatedUser(request, db);
    if (!currentUser) return Response.json({ error: 'unauthenticated' }, { status: 401 });
    const now = new Date().toISOString();
    const rows = await db`
      UPDATE users
      SET name = ${profile.name}, email = ${profile.email}, phone = ${profile.phone},
          postcode = ${profile.postcode}, tennis_level = ${profile.tennisLevel},
          preferred_time = ${profile.preferredTime}, preferred_format = ${profile.preferredFormat},
          updated_at = ${now}
      WHERE id = ${currentUser.id}
      RETURNING id, name, email, phone, password_hash, postcode, tennis_level, preferred_time, preferred_format
    ` as Parameters<typeof serializeUser>[0][];
    if (!rows[0]) return Response.json({ error: 'unauthenticated' }, { status: 401 });
    return Response.json({ user: serializeUser(rows[0]) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return Response.json({ error: 'email_exists' }, { status: 409 });
    }
    console.error('Unable to update user profile', error);
    return Response.json({ error: 'profile_update_unavailable' }, { status: 503 });
  }
}
