import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changedFields, isUndoable, SESSION_FIELDS, undoAdminAction, venueSnapshots } from '../lib/server/audit-log';
import type { Database } from '../lib/server/database';

const before = {
  id: 's1', venue_id: 'v1', date: '2026-10-24', start_time: '10:00', end_time: '11:00', price_pence: 600,
  capacity: 4, booked_spots: 1, marked_full: false, formats_json: '["singles"]', seeking_levels_json: '[]', status: 'published',
};
const after = { ...before, price_pence: 700, status: 'draft' };

function scripted(steps: Array<{ match: RegExp; rows: unknown[] }>) {
  let count = 0;
  const db = ((parts: TemplateStringsArray) => {
    const sql = parts.join('?').replace(/\s+/g, ' ');
    const step = steps[count++];
    assert.ok(step, `Unexpected query: ${sql}`);
    assert.match(sql, step.match);
    return Promise.resolve(step.rows);
  }) as unknown as Database;
  return { db, done: () => assert.equal(count, steps.length) };
}

const entry = (action: string, b: unknown, a: unknown, undone: string | null = null) => ({
  id: 'a1', created_at: '', actor: 'admin', action, target_type: action.split('.')[0], target_id: 's1', summary: 'x',
  before_json: b ? JSON.stringify(b) : null, after_json: a ? JSON.stringify(a) : null, undone_at: undone, undone_by: null,
});

void test('only session edits and venue edits can be undone, once', () => {
  assert.equal(isUndoable(entry('session.update', before, after)), true);
  assert.equal(isUndoable(entry('session.create', null, after)), false);
  assert.equal(isUndoable(entry('session.delete', before, null)), false);
  assert.equal(isUndoable(entry('booking.refund', { status: 'confirmed' }, { status: 'refunded' })), false);
  assert.equal(isUndoable(entry('session.update', before, after, '2026-10-19')), false);
  assert.deepEqual(changedFields(before, after, SESSION_FIELDS), ['price_pence', 'status']);
});

void test('venue snapshots leave unchanged photos out', () => {
  const venue = { name: 'A', photo: 'data:image/png;base64,AAAA', photos_json: '["data:..."]', peak_price_pence: 1 };
  const kept = venueSnapshots(venue, { ...venue, name: 'B' });
  assert.equal('photo' in kept.after, false);
  assert.equal(kept.before?.name, 'A');
  const changed = venueSnapshots(venue, { ...venue, photo: 'data:new' });
  assert.equal(changed.after.photo, 'data:new');
});

void test('undoing a session edit restores the earlier values and logs the undo', async () => {
  const script = scripted([
    { match: /SELECT \* FROM admin_audit_log/, rows: [entry('session.update', before, { ...before, status: 'draft' })] },
    { match: /SELECT \* FROM sessions/, rows: [{ ...before, status: 'draft' }] },
    { match: /UPDATE sessions SET venue_id = \?.*booked_spots <= \?/, rows: [{ id: 's1' }] },

  ]);
  assert.deepEqual(await undoAdminAction(script.db, new Request('https://x'), 'a1'), { status: 'undone' });
  script.done();
});

void test('an undo is refused when the session changed again or locked fields would move', async () => {
  const changed = scripted([
    { match: /admin_audit_log/, rows: [entry('session.update', before, after)] },
    { match: /SELECT \* FROM sessions/, rows: [{ ...after, capacity: 6 }] },
  ]);
  assert.deepEqual(await undoAdminAction(changed.db, new Request('https://x'), 'a1'), { status: 'changed_since' });
  const locked = scripted([
    { match: /admin_audit_log/, rows: [entry('session.update', before, after)] },
    { match: /SELECT \* FROM sessions/, rows: [after] },

  ]);
  // price differs between before and now, and the session has a confirmed booking
  assert.deepEqual(await undoAdminAction(locked.db, new Request('https://x'), 'a1'), { status: 'locked_fields' });
});

void test('creation cannot be undone through a delete outside the plan', async () => {
  const script = scripted([{ match: /admin_audit_log/, rows: [entry('session.create', null, before)] }]);
  assert.deepEqual(await undoAdminAction(script.db, new Request('https://x'), 'a1'), { status: 'not_undoable' });
  script.done();
});

void test('a concurrent session change blocks undo, including end time, formats and marked-full', async () => {
  const script = scripted([
    { match: /admin_audit_log/, rows: [entry('session.update', before, { ...before, status: 'draft' })] },
    { match: /SELECT \* FROM sessions/, rows: [{ ...before, status: 'draft' }] },
    { match: /FOR UPDATE.*to_jsonb\(sessions\) @>.*UPDATE admin_audit_log.*INSERT INTO admin_audit_log/, rows: [] },
  ]);
  assert.deepEqual(await undoAdminAction(script.db, new Request('https://x'), 'a1'), { status: 'changed_since' });
  script.done();
});
