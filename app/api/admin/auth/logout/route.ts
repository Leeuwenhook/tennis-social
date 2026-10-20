import { clearAdminSessionCookie, requireSameOrigin } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  return Response.json(
    { authenticated: false },
    { headers: { 'Set-Cookie': clearAdminSessionCookie() } },
  );
}
