import { clearUserSessionCookie, deleteUserSession } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    await deleteUserSession(request);
  } catch (error) {
    console.error('Unable to delete user session', error);
  }
  return Response.json(
    { authenticated: false },
    { headers: { 'Set-Cookie': clearUserSessionCookie() } },
  );
}
