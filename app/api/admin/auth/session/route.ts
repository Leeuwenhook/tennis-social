import { isAdminAuthenticated } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authenticated = isAdminAuthenticated(request);
  return Response.json(
    { authenticated },
    { status: authenticated ? 200 : 401 },
  );
}
