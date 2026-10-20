import { adminCursor, readAdminCursor } from './admin-pagination';
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
export const UNDOABLE_ACTIONS = ['session.update', 'venue.update'] as const;

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

/** Wrap a single mutation with its audit INSERT. An audit failure rolls back the write.
 * Only SQL from a tagged template is used; values remain positional parameters.
 */
export function auditedMutation(db: Database, request: Request, entry: AuditEntry) {
  return (parts: TemplateStringsArray, ...values: unknown[]) => {
    let mutation = parts.reduce((sql, part, index) => sql + (index ? `$${index}` : '') + part, '');
    const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
    const tables: Partial<Record<AuditEntry['targetType'], string>> = {
      session: 'sessions', venue: 'venues', request: 'reservation_requests', application: 'partner_request_applications', review: 'session_reviews', settings: 'app_settings',
    };
    const table = tables[entry.targetType];
    const capturePrior = table && (/^\s*(UPDATE|DELETE)\b/.test(mutation) || entry.targetType === 'settings');
    const prior = capturePrior ? `prior AS MATERIALIZED (SELECT * FROM ${table} WHERE ${entry.targetType === 'settings' ? 'key' : 'id'} = ${bind(entry.targetId)} FOR UPDATE),` : '';
    if (capturePrior) mutation = entry.targetType === 'settings'
      ? mutation.replace(/VALUES\s*\(([^)]+)\)/, 'SELECT $1 FROM (SELECT COUNT(*) FROM prior) AS locked_prior WHERE true')
      : mutation.replace(/\bWHERE\b/, 'WHERE EXISTS (SELECT 1 FROM prior) AND');
    const beforeValue = capturePrior ? '' : bind(json(entry.before));
    let before = capturePrior ? '(SELECT to_jsonb(prior)::text FROM prior)' : beforeValue;
    let after = entry.after === undefined ? (entry.action.endsWith('.delete') ? 'NULL' : 'to_jsonb(changed)::text') : bind(json(entry.after));
    if (entry.targetType === 'review' && capturePrior && !entry.action.endsWith('.delete')) {
      before = `json_build_object('review', (SELECT to_jsonb(prior) FROM prior), 'media', (SELECT json_agg(review_media) FROM review_media WHERE review_id = (SELECT id FROM prior)))::text`;
    }
    if (entry.targetType === 'venue' && capturePrior && !entry.action.endsWith('.delete')) {
      const photosChanged = '(SELECT prior.photo IS DISTINCT FROM changed.photo OR prior.photos_json IS DISTINCT FROM changed.photos_json FROM prior)';
      before = `(SELECT (CASE WHEN ${photosChanged} THEN to_jsonb(prior) ELSE to_jsonb(prior) - 'photo' - 'photos_json' END)::text FROM prior)`;
      after = `(CASE WHEN ${photosChanged} THEN to_jsonb(changed) ELSE to_jsonb(changed) - 'photo' - 'photos_json' END)::text`;
    }
    const query = `WITH ${prior} changed AS (${mutation}), logged AS (
      INSERT INTO admin_audit_log (id, created_at, actor, action, target_type, target_id, summary, before_json, after_json)
      SELECT ${bind(`audit-${crypto.randomUUID()}`)}, ${bind(new Date().toISOString())}, ${bind(adminUsername(request) ?? 'unknown')},
             ${bind(entry.action)}, ${bind(entry.targetType)}, ${bind(entry.targetId)}, ${bind(entry.summary.slice(0, 500))}, ${before}, ${after}
      FROM changed RETURNING id
    ) SELECT * FROM changed`;
    return db.query(query, values);
  };
}

/** Build an audit INSERT for inclusion in a batch transaction. */
export function adminActionQuery(db: Database, request: Request, entry: AuditEntry) {
  return db`
    INSERT INTO admin_audit_log (id, created_at, actor, action, target_type, target_id, summary, before_json, after_json)
    VALUES (${`audit-${crypto.randomUUID()}`}, ${new Date().toISOString()}, ${adminUsername(request) ?? 'unknown'},
            ${entry.action}, ${entry.targetType}, ${entry.targetId}, ${entry.summary.slice(0, 500)},
            ${json(entry.before)}, ${json(entry.after)})
  `;
}

/** Surface a logging failure to the caller; never report unaudited success. */
export async function recordAdminAction(db: Database, request: Request, entry: AuditEntry) {
  await adminActionQuery(db, request, entry);
}

export function isUndoable(row: Pick<AuditRow, 'action' | 'undone_at' | 'before_json' | 'after_json'>) {
  if (row.undone_at || !(UNDOABLE_ACTIONS as readonly string[]).includes(row.action)) return false;
  return Boolean(row.before_json && row.after_json);
}

/** Field-by-field differences, for showing what an entry changed. */
export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null, fields: readonly string[]) {
  if (!before || !after) return [];
  return fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

const PAGE_SIZE = 50;

export async function listAuditLog(db: Database, params: URLSearchParams) {
  const cursor = readAdminCursor(params.get('cursor'));
  const targetType = params.get('targetType') || null;
  const targetId = params.get('targetId') || null;
  const offset = Math.max(0, Math.min(100000, Math.floor(Number(params.get('offset')) || 0)));
  const rows = (await db`
    SELECT * FROM (
      SELECT * FROM admin_audit_log
      UNION ALL
      SELECT id, created_at, username AS actor,
             CASE WHEN success THEN 'auth.login.success' ELSE 'auth.login.failed' END AS action,
             'auth' AS target_type, username AS target_id, '' AS summary,
             NULL::text AS before_json, NULL::text AS after_json, NULL::text AS undone_at, NULL::text AS undone_by
      FROM admin_login_attempts
    ) AS activity
    WHERE (${targetType}::text IS NULL OR target_type = ${targetType})
      AND (${targetId}::text IS NULL OR target_id = ${targetId})
      AND (${cursor?.id ?? null}::text IS NULL OR (created_at, id) < (${cursor?.created ?? null}, ${cursor?.id ?? null}))
    ORDER BY created_at DESC, id DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${cursor ? 0 : offset}
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
    nextCursor: rows.length > PAGE_SIZE ? adminCursor({ id: rows[PAGE_SIZE - 1].id, created: rows[PAGE_SIZE - 1].created_at }) : null,
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
 * a venue edit is
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

  const actor = adminUsername(request) ?? 'unknown';
  const fields = entry.action === 'session.update' ? SESSION_FIELDS : VENUE_FIELDS;
  const expected = JSON.stringify(Object.fromEntries(fields.filter((field) => field in after).map((field) => [field, after[field]])));
  let restored: Array<{ id: string }>;
  if (entry.action === 'session.update') {
    const rows = (await db`SELECT * FROM sessions WHERE id = ${entry.target_id}`) as Array<Record<string, unknown>>;
    const current = rows[0];
    if (!current) return { status: 'not_found' };
    if (!same(current, after, SESSION_FIELDS)) return { status: 'changed_since' };
    // Pending checkouts also lock price/place/time: their payment may complete later.
    const changesLocked = !same(current, before, LOCKED_SESSION_FIELDS);
    if (Number(current.booked_spots) > 0 && changesLocked) return { status: 'locked_fields' };
    if (Number(current.booked_spots) > Number(before.capacity)) return { status: 'capacity_too_low' };
    restored = (await db`
      WITH claimed AS (
        SELECT id FROM admin_audit_log WHERE id = ${entry.id} AND undone_at IS NULL FOR UPDATE
      ), restored AS (
        UPDATE sessions
        SET venue_id = ${before.venue_id as string}, date = ${before.date as string}, start_time = ${before.start_time as string},
            end_time = ${before.end_time as string}, price_pence = ${before.price_pence as number}, capacity = ${before.capacity as number},
            marked_full = ${Boolean(before.marked_full)}, formats_json = ${before.formats_json as string},
            seeking_levels_json = ${before.seeking_levels_json as string}, status = ${before.status as string}, updated_at = ${now}
        WHERE id = ${entry.target_id} AND booked_spots <= ${before.capacity as number}
          AND (NOT ${changesLocked} OR booked_spots = 0)
          AND to_jsonb(sessions) @> ${expected}::jsonb
          AND EXISTS (SELECT 1 FROM claimed)
        RETURNING id
      ), marked AS (
        UPDATE admin_audit_log SET undone_at = ${now}, undone_by = ${actor}
        WHERE id = ${entry.id} AND EXISTS (SELECT 1 FROM restored) RETURNING id
      ), logged AS (
        INSERT INTO admin_audit_log (id, created_at, actor, action, target_type, target_id, summary, before_json, after_json)
        SELECT ${`audit-${crypto.randomUUID()}`}, ${now}, ${actor}, 'undo', ${entry.target_type}, ${entry.target_id},
               ${`Undid ${entry.action}: ${entry.summary}`}, ${JSON.stringify(after)}, ${JSON.stringify(before)} FROM marked
        RETURNING id
      ) SELECT id FROM logged
    `) as Array<{ id: string }>;
  } else {
    const rows = (await db`SELECT * FROM venues WHERE id = ${entry.target_id}`) as Array<Record<string, unknown>>;
    if (!rows[0]) return { status: 'not_found' };
    if (!same(rows[0], after, VENUE_FIELDS)) return { status: 'changed_since' };
    restored = (await db`
      WITH claimed AS (
        SELECT id FROM admin_audit_log WHERE id = ${entry.id} AND undone_at IS NULL FOR UPDATE
      ), restored AS (
        UPDATE venues
        SET name = ${before.name as string}, name_zh = ${before.name_zh as string}, area = ${before.area as string},
            area_zh = ${before.area_zh as string}, address = ${(before.address as string) ?? ''}, address_zh = ${(before.address_zh as string) ?? ''},
            postcode = ${(before.postcode as string) ?? ''}, description = ${(before.description as string | null) ?? null},
            description_zh = ${(before.description_zh as string | null) ?? null}, notes = ${(before.notes as string) ?? ''},
            photo = COALESCE(${(before.photo as string | undefined) ?? null}::text, photo),
            photos_json = COALESCE(${(before.photos_json as string | undefined) ?? null}::text, photos_json),
            peak_price_pence = ${before.peak_price_pence as number}, off_peak_price_pence = ${before.off_peak_price_pence as number},
            updated_at = ${now}
        WHERE id = ${entry.target_id} AND to_jsonb(venues) @> ${expected}::jsonb
          AND EXISTS (SELECT 1 FROM claimed)
        RETURNING id
      ), marked AS (
        UPDATE admin_audit_log SET undone_at = ${now}, undone_by = ${actor}
        WHERE id = ${entry.id} AND EXISTS (SELECT 1 FROM restored) RETURNING id
      ), logged AS (
        INSERT INTO admin_audit_log (id, created_at, actor, action, target_type, target_id, summary, before_json, after_json)
        SELECT ${`audit-${crypto.randomUUID()}`}, ${now}, ${actor}, 'undo', ${entry.target_type}, ${entry.target_id},
               ${`Undid ${entry.action}: ${entry.summary}`}, ${JSON.stringify(after)}, ${JSON.stringify(before)} FROM marked
        RETURNING id
      ) SELECT id FROM logged
    `) as Array<{ id: string }>;
  }
  return { status: restored[0] ? 'undone' : 'changed_since' };
}
