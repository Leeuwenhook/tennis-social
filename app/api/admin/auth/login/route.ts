import {
  adminSessionCookie,
  areAdminCredentialsValid,
  createAdminSession,
} from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
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
  if (!areAdminCredentialsValid(username, password)) {
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
