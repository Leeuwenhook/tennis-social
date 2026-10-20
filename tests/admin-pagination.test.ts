import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminCursor, readAdminCursor } from '../lib/server/admin-pagination';
import { searchAdminBookings } from '../lib/server/admin-bookings';
import { loadAdminOverview } from '../lib/server/admin-overview';
import type { Database } from '../lib/server/database';

void test('cursors preserve tied timestamps and reject malformed or oversized input', () => {
  const position = { id: 'b49', created: '2026-10-20T10:00:00Z', date: '2026-10-22', start: '10:00' };
  assert.deepEqual(readAdminCursor(adminCursor(position)), position);
  for (const value of ['', 'bad-json', 'x'.repeat(3000), adminCursor({ id: 'b' })]) assert.equal(readAdminCursor(value), null);
});
void test('booking pagination seeks by date, time, creation and ID instead of skipping new rows', async () => {
  const position = { id: 'b49', created: '2026-10-20T10:00:00Z', date: '2026-10-22', start: '10:00' };
  const db = ((parts: TemplateStringsArray, ...params: unknown[]) => {
    const sql = parts.join('?').replace(/\s+/g, ' ');
    assert.match(sql, /\(bookings.created_at, bookings.id\) </);
    assert.match(sql, /cancellations.completed_at IS NULL OR cancellations.email_status/);
    assert.match(sql, /bookings.created_at DESC, bookings.id DESC/);
    assert.match(sql, /sessions.date, sessions.start_time\) >/);
    assert.equal(params.at(-1), 0, 'cursor requests must not apply the old offset');
    assert.ok(params.includes(position.id));
    return Promise.resolve([]);
  }) as unknown as Database;
  const result = await searchAdminBookings(db, new URLSearchParams({ scope: 'upcoming', offset: '50', cursor: adminCursor(position) }));
  assert.equal(result.nextCursor, null);
});
void test('overview warns only about lone-player sessions starting within 48 hours', async () => {
  const db = ((parts: TemplateStringsArray) => {
    const sql = parts.join('?');
    if (sql.includes('venues.name AS venue_name')) return Promise.resolve([
      { id: 'near', date: '2026-10-22', start_time: '10:00', end_time: '11:00', status: 'published', marked_full: false },
      { id: 'later', date: '2026-10-24', start_time: '10:00', end_time: '11:00', status: 'published', marked_full: false },
    ]);
    if (sql.includes('bookings.participants_json')) return Promise.resolve(['near', 'later'].map((session_id) => ({ id: session_id, session_id, status: 'confirmed', participant_count: 1, participants_json: '["3.0"]' })));
    return Promise.resolve([]);
  }) as unknown as Database;
  const result = await loadAdminOverview(db, new Date('2026-10-20T12:00:00Z'));
  assert.ok(result.sessions[0].autoRefundAt);
  assert.equal(result.sessions[1].autoRefundAt, null);
});
