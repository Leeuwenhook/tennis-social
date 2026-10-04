import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  racketRentalEnabled,
  setRacketRentalEnabled,
} from '@/lib/server/database';
import { requireAdmin } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = database();
    await ensureSeeded(db);
    return Response.json({ racketRentalEnabled: await racketRentalEnabled(db) });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to load admin settings', error);
    return Response.json({ error: 'settings_unavailable' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let input: { racketRentalEnabled?: unknown };
  try {
    input = await request.json() as { racketRentalEnabled?: unknown };
  } catch {
    return Response.json({ error: 'invalid_settings' }, { status: 400 });
  }
  if (typeof input.racketRentalEnabled !== 'boolean') {
    return Response.json({ error: 'invalid_settings' }, { status: 400 });
  }
  try {
    const db = database();
    await ensureSeeded(db);
    const enabled = await setRacketRentalEnabled(input.racketRentalEnabled, db);
    return Response.json({ racketRentalEnabled: enabled });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to update admin settings', error);
    return Response.json({ error: 'settings_unavailable' }, { status: 503 });
  }
}
