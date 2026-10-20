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

void test('only session edits, new sessions and venue edits can be undone, once', () => {
  assert.equal(isUndoable(entry('session.update', before, after)), true);
  assert.equal(isUndoable(entry('session.create', null, after)), true);
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
    { match: /SELECT \* FROM admin_audit_log/, rows: [entry('session.update', before, after)] },
    { match: /SELECT \* FROM sessions/, rows: [after] },
    { match: /FROM bookings WHERE session_id/, rows: [{ all_bookings: 0, confirmed: 0 }] },
    { match: /UPDATE sessions SET venue_id = \?.*booked_spots <= \?/, rows: [{ id: 's1' }] },
    { match: /UPDATE admin_audit_log SET undone_at/, rows: [] },
    { match: /INSERT INTO admin_audit_log/, rows: [] },
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
    { match: /FROM bookings/, rows: [{ all_bookings: 1, confirmed: 1 }] },
  ]);
  // price differs between before and now, and the session has a confirmed booking
  assert.deepEqual(await undoAdminAction(locked.db, new Request('https://x'), 'a1'), { status: 'locked_fields' });
});

void test('undoing a new session deletes it only when nobody booked', async () => {
  const booked = scripted([
    { match: /admin_audit_log/, rows: [entry('session.create', null, before)] },
    { match: /SELECT \* FROM sessions/, rows: [before] },
    { match: /FROM bookings/, rows: [{ all_bookings: 1, confirmed: 0 }] },
  ]);
  assert.deepEqual(await undoAdminAction(booked.db, new Request('https://x'), 'a1'), { status: 'has_bookings' });
  const empty = scripted([
    { match: /admin_audit_log/, rows: [entry('session.create', null, before)] },
    { match: /SELECT \* FROM sessions/, rows: [before] },
    { match: /FROM bookings/, rows: [{ all_bookings: 0, confirmed: 0 }] },
    { match: /DELETE FROM sessions/, rows: [{ id: 's1' }] },
    { match: /UPDATE admin_audit_log/, rows: [] },
    { match: /INSERT INTO admin_audit_log/, rows: [] },
  ]);
  assert.deepEqual(await undoAdminAction(empty.db, new Request('https://x'), 'a1'), { status: 'undone' });
});
