import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  racketRentalEnabled,
} from '@/lib/server/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = database();
    await ensureSeeded(db);
    return Response.json({ racketRentalEnabled: await racketRentalEnabled(db) });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfiguredError)) {
      console.error('Unable to load public app settings', error);
    }
    // Keep the storefront usable in local previews. Checkout still refuses to
    // create a booking when its database is unavailable.
    return Response.json({ racketRentalEnabled: false, error: 'settings_unavailable' }, { status: 503 });
  }
}
