import { clearAdminSessionCookie } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  return Response.json(
    { authenticated: false },
    { headers: { 'Set-Cookie': clearAdminSessionCookie() } },
  );
}
