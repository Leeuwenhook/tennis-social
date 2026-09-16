import {
  database,
  DatabaseNotConfiguredError,
  resetSeed,
} from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    const seed = await resetSeed(database());
    return Response.json({ sessions: seed.sessions, bookings: seed.bookings });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to reset demo data', error);
    return Response.json({ error: 'reset_unavailable' }, { status: 503 });
  }
}
