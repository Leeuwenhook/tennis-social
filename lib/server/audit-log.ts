import { adminUsername } from './admin-auth';
import type { Database } from './database';

/** Session columns an undo restores; booked_spots is never restored. */
export const SESSION_FIELDS = [
  'venue_id', 'date', 'start_time', 'end_time', 'price_pence', 'capacity',
  'marked_full', 'formats_json', 'seeking_levels_json', 'status',
] as const;
/** Session columns that are locked while a session has confirmed bookings. */
const LOCKED_SESSION_FIELDS = ['venue_id', 'date', 'start_time', 'end_time', 'price_pence'] as const;
export const VENUE_FIELDS = [
  'name', 'name_zh', 'area', 'area_zh', 'address', 'address_zh', 'postcode', 'description',
  'description_zh', 'notes', 'photo', 'photos_json', 'peak_price_pence', 'off_peak_price_pence',
] as const;

const PHOTO_FIELDS = ['photo', 'photos_json'];

/**
 * Venue snapshots for the log. Photos can be large data URLs, so they are
 * kept only when the edit changed them.
 */
export function venueSnapshots(before: Record<string, unknown> | undefined, after: Record<string, unknown>) {
  const pick = (row: Record<string, unknown>, keepPhotos: boolean) =>
    Object.fromEntries(VENUE_FIELDS.filter((field) => keepPhotos || !PHOTO_FIELDS.includes(field)).map((field) => [field, row[field] ?? null]));
  const photosChanged = !before || PHOTO_FIELDS.some((field) => before[field] !== after[field]);
  return { before: before ? pick(before, photosChanged) : undefined, after: pick(after, photosChanged) };
}

/** Actions that can be undone from the log. Deletes, refunds and cancellations cannot. */
export const UNDOABLE_ACTIONS = ['session.update', 'session.create', 'venue.update'] as const;

export type AuditEntry = {
  action: string;
  targetType: 'session' | 'venue' | 'booking' | 'request' | 'application' | 'review' | 'settings' | 'import';
  targetId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
};

export type AuditRow = {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  summary: string;
  before_json: string | null;
  after_json: string | null;
  undone_at: string | null;
  undone_by: string | null;
};

function json(value: unknown) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

/** Records an admin action. Logging never makes the action itself fail. */
export async function recordAdminAction(db: Database, request: Request, entry: AuditEntry) {
  try {
    await db`
      INSERT INTO admin_audit_log (id, created_at, actor, action, target_type, target_id, summary, before_json, after_json)
      VALUES (${`audit-${crypto.randomUUID()}`}, ${new Date().toISOString()}, ${adminUsername(request) ?? 'unknown'},
              ${entry.action}, ${entry.targetType}, ${entry.targetId}, ${entry.summary.slice(0, 500)},
              ${json(entry.before)}, ${json(entry.after)})
    `;
  } catch {
    console.error('Unable to record admin action', entry.action, entry.targetId);
  }
}

export function isUndoable(row: Pick<AuditRow, 'action' | 'undone_at' | 'before_json' | 'after_json'>) {
  if (row.undone_at || !(UNDOABLE_ACTIONS as readonly string[]).includes(row.action)) return false;
  return row.action === 'session.create' ? Boolean(row.after_json) : Boolean(row.before_json && row.after_json);
}

/** Field-by-field differences, for showing what an entry changed. */
export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null, fields: readonly string[]) {
  if (!before || !after) return [];
  return fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

const PAGE_SIZE = 50;

export async function listAuditLog(db: Database, params: URLSearchParams) {
  const targetType = params.get('targetType') || null;
  const targetId = params.get('targetId') || null;
  const offset = Math.max(0, Math.min(100000, Number(params.get('offset')) || 0));
  const rows = (await db`
    SELECT * FROM admin_audit_log
    WHERE (${targetType}::text IS NULL OR target_type = ${targetType})
      AND (${targetId}::text IS NULL OR target_id = ${targetId})
    ORDER BY created_at DESC, id DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}
  `) as AuditRow[];
  return {
    entries: rows.slice(0, PAGE_SIZE).map((row) => {
      const before = row.before_json ? (JSON.parse(row.before_json) as Record<string, unknown>) : null;
      const after = row.after_json ? (JSON.parse(row.after_json) as Record<string, unknown>) : null;
      const fields = row.target_type === 'venue' ? VENUE_FIELDS : row.target_type === 'session' ? SESSION_FIELDS : [];
      return {
        id: row.id,
        createdAt: row.created_at,
        actor: row.actor,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        summary: row.summary,
        changes: changedFields(before, after, fields).map((field) => ({ field, before: before?.[field] ?? null, after: after?.[field] ?? null })),
        undoneAt: row.undone_at,
        undoneBy: row.undone_by,
        undoable: isUndoable(row),
      };
    }),
    nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : null,
  };
}

export type UndoResult =
  | { status: 'undone' }
  | { status: 'not_found' | 'not_undoable' | 'already_undone' | 'changed_since' | 'locked_fields' | 'capacity_too_low' | 'has_bookings' };

/** Compares the fields the snapshot holds; a venue snapshot may leave photos out. */
function same(row: Record<string, unknown>, snapshot: Record<string, unknown>, fields: readonly string[]) {
  return fields
    .filter((field) => field in snapshot)
    .every((field) => JSON.stringify(row[field] ?? null) === JSON.stringify(snapshot[field] ?? null));
}

/**
 * Reverts one logged change, provided nothing has changed the target since.
 * A session edit is restored to its earlier values (never its booked count);
 * a created session is deleted if nobody has booked it; a venue edit is
 * restored. The undo is itself logged.
 */
export async function undoAdminAction(db: Database, request: Request, entryId: string): Promise<UndoResult> {
  const entries = (await db`SELECT * FROM admin_audit_log WHERE id = ${entryId}`) as AuditRow[];
  const entry = entries[0];
  if (!entry) return { status: 'not_found' };
  if (entry.undone_at) return { status: 'already_undone' };
  if (!isUndoable(entry)) return { status: 'not_undoable' };
  const before = entry.before_json ? (JSON.parse(entry.before_json) as Record<string, unknown>) : {};
  const after = JSON.parse(entry.after_json ?? '{}') as Record<string, unknown>;
  const now = new Date().toISOString();

  if (entry.action === 'session.update' || entry.action === 'session.create') {
    const rows = (await db`SELECT * FROM sessions WHERE id = ${entry.target_id}`) as Array<Record<string, unknown>>;
    const current = rows[0];
    if (!current) return { status: 'not_found' };
    if (!same(current, after, SESSION_FIELDS)) return { status: 'changed_since' };
    const bookings = (await db`
      SELECT COUNT(*)::integer AS all_bookings,
             COUNT(*) FILTER (WHERE status = 'confirmed')::integer AS confirmed
      FROM bookings WHERE session_id = ${entry.target_id}
    `) as Array<{ all_bookings: number; confirmed: number }>;
    if (entry.action === 'session.create') {
      if ((bookings[0]?.all_bookings ?? 0) > 0) return { status: 'has_bookings' };
      const deleted = (await db`
        DELETE FROM sessions WHERE id = ${entry.target_id}
          AND NOT EXISTS (SELECT 1 FROM bookings WHERE session_id = ${entry.target_id})
        RETURNING id
      `) as Array<{ id: string }>;
      if (!deleted[0]) return { status: 'has_bookings' };
    } else {
      if ((bookings[0]?.confirmed ?? 0) > 0 && !same(current, before, LOCKED_SESSION_FIELDS)) return { status: 'locked_fields' };
      const updated = (await db`
        UPDATE sessions
        SET venue_id = ${before.venue_id as string}, date = ${before.date as string}, start_time = ${before.start_time as string},
            end_time = ${before.end_time as string}, price_pence = ${before.price_pence as number}, capacity = ${before.capacity as number},
            marked_full = ${Boolean(before.marked_full)}, formats_json = ${before.formats_json as string},
            seeking_levels_json = ${before.seeking_levels_json as string}, status = ${before.status as string}, updated_at = ${now}
        WHERE id = ${entry.target_id} AND booked_spots <= ${before.capacity as number}
          AND venue_id = ${current.venue_id as string} AND date = ${current.date as string}
          AND start_time = ${current.start_time as string} AND price_pence = ${current.price_pence as number}
          AND capacity = ${current.capacity as number} AND status = ${current.status as string}
        RETURNING id
      `) as Array<{ id: string }>;
      if (!updated[0]) return { status: 'capacity_too_low' };
    }
  } else if (entry.action === 'venue.update') {
    const rows = (await db`SELECT * FROM venues WHERE id = ${entry.target_id}`) as Array<Record<string, unknown>>;
    const current = rows[0];
    if (!current) return { status: 'not_found' };
    if (!same(current, after, VENUE_FIELDS)) return { status: 'changed_since' };
    await db`
      UPDATE venues
      SET name = ${before.name as string}, name_zh = ${before.name_zh as string}, area = ${before.area as string},
          area_zh = ${before.area_zh as string}, address = ${(before.address as string) ?? ''}, address_zh = ${(before.address_zh as string) ?? ''},
          postcode = ${(before.postcode as string) ?? ''}, description = ${(before.description as string | null) ?? null},
          description_zh = ${(before.description_zh as string | null) ?? null}, notes = ${(before.notes as string) ?? ''},
          photo = COALESCE(${(before.photo as string | undefined) ?? null}::text, photo),
          photos_json = COALESCE(${(before.photos_json as string | undefined) ?? null}::text, photos_json),
          peak_price_pence = ${before.peak_price_pence as number}, off_peak_price_pence = ${before.off_peak_price_pence as number},
          updated_at = ${now}
      WHERE id = ${entry.target_id}
    `;
  }

  const actor = adminUsername(request) ?? 'unknown';
  await db`UPDATE admin_audit_log SET undone_at = ${now}, undone_by = ${actor} WHERE id = ${entry.id} AND undone_at IS NULL`;
  await recordAdminAction(db, request, {
    action: 'undo',
    targetType: entry.target_type as AuditEntry['targetType'],
    targetId: entry.target_id,
    // "<original action>: <original summary>"; the admin UI shows the action by name.
    summary: `${entry.action}: ${entry.summary}`,
    before: after,
    after: entry.action === 'session.create' ? null : before,
  });
  return { status: 'undone' };
}
