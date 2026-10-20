import { auditedMutation } from '@/lib/server/audit-log';
import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  racketRentalEnabled,
  RACKET_RENTAL_SETTING_KEY,
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
  if (!input || typeof input !== 'object') return Response.json({ error: 'invalid_settings' }, { status: 400 });
  if (typeof input.racketRentalEnabled !== 'boolean') {
    return Response.json({ error: 'invalid_settings' }, { status: 400 });
  }
  try {
    const db = database();
    await ensureSeeded(db);
    const mutation = auditedMutation(db, request, {
      action: 'settings.update', targetType: 'settings', targetId: RACKET_RENTAL_SETTING_KEY, summary: `racketRentalEnabled = ${input.racketRentalEnabled}`,
    })`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${RACKET_RENTAL_SETTING_KEY}, ${input.racketRentalEnabled ? 'true' : 'false'}, ${new Date().toISOString()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      RETURNING value
    `;
    const result = await db.transaction([
      db`SELECT pg_advisory_xact_lock(hashtextextended('admin-racket-rental', 0))`, mutation,
    ]);
    const rows = result[1] as Array<{ value: string }>;
    const enabled = rows[0]?.value === 'true';
    return Response.json({ racketRentalEnabled: enabled });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to update admin settings', error);
    return Response.json({ error: 'settings_unavailable' }, { status: 503 });
  }
}
