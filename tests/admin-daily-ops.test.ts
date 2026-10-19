import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoRefundDecisionAt, londonWeek } from '../lib/server/admin-overview';
import { likePattern, parseBookingSearch } from '../lib/server/admin-bookings';
import { cancelBooking } from '../lib/server/admin-cancel-booking';
import { renderAdminCancellationEmail } from '../lib/server/email';
import { rosterText } from '../components/admin/admin-overview';
import type { BookingRow, Database } from '../lib/server/database';
import { venues } from '../lib/demo-data';

void test('the London week runs Monday to Sunday', () => {
  assert.deepEqual(londonWeek(new Date('2026-10-19T12:00:00Z')), { start: '2026-10-19', end: '2026-10-25' });
  assert.deepEqual(londonWeek(new Date('2026-10-25T22:30:00Z')), { start: '2026-10-19', end: '2026-10-25' });
  // 00:30 London on Monday 26 Oct (GMT) is already the next week.
  assert.deepEqual(londonWeek(new Date('2026-10-26T00:30:00Z')), { start: '2026-10-26', end: '2026-11-01' });
});

void test('auto-refund decisions happen at the last 18:00 London at least 24h before the start', () => {
  assert.equal(autoRefundDecisionAt('2026-10-22', '10:00')?.toISOString(), '2026-10-20T17:00:00.000Z');
  assert.equal(autoRefundDecisionAt('2026-10-22', '18:00')?.toISOString(), '2026-10-21T17:00:00.000Z');
  assert.equal(autoRefundDecisionAt('2026-12-10', '19:30')?.toISOString(), '2026-12-09T18:00:00.000Z');
  assert.equal(autoRefundDecisionAt('bad', '10:00'), null);
});

void test('booking search defaults to upcoming and escapes LIKE wildcards', () => {
  assert.deepEqual(parseBookingSearch(new URLSearchParams('scope=x&status=nope&offset=-5')), {
    scope: 'upcoming', venueId: null, status: null, query: null, offset: 0,
  });
  assert.equal(parseBookingSearch(new URLSearchParams('scope=past&status=refunded&q=%20ana%20')).query, 'ana');
  assert.equal(likePattern('50%_a'), '%50\\%\\_a%');
});

void test('rosters copy as one line per booking', () => {
  const text = rosterText({ date: '2026-10-22', startTime: '10:00', endTime: '11:00', venueName: 'Vauxhall Park' }, [
    { id: 'b1', contactName: 'Ana', email: 'a@x', phone: '07000', participants: ['3.0', '3.5'], participantCount: 2, format: 'doubles', totalPence: 1200, status: 'confirmed' },
  ]);
  assert.equal(text, 'Vauxhall Park 2026-10-22 10:00–11:00\n1. Ana ×2 · 3.0/3.5 · doubles · 07000');
});

const booking = { id: 'b1', session_id: 's1', contact_name: 'Ana', email: 'a@x', status: 'confirmed', total_pence: 630, stripe_payment_intent_id: 'pi_1', participant_count: 1 } as BookingRow;

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

const venueDetails = { ...venues[0], name_zh: venues[0].nameZh, area_zh: venues[0].areaZh, photo: '', photos_json: '[]', date: '2026-10-22', start_time: '10:00', end_time: '11:00' };

void test('cancelling with refund refunds first, then releases places and emails the player', async () => {
  const calls: string[] = [];
  const script = scripted([
    { match: /SELECT \* FROM bookings/, rows: [booking] },
    { match: /UPDATE bookings SET status = \?.*booked_spots/, rows: [{ ...booking, status: 'refunded' }] },
    { match: /FROM sessions JOIN venues/, rows: [venueDetails] },
  ]);
  const result = await cancelBooking(script.db, 'b1', true, {
    refund: (input) => { calls.push(`refund:${input.paymentIntentId}:${input.reason}`); return Promise.resolve({ id: 're_1', status: 'succeeded' }); },
    notify: (input) => { calls.push(`email:${input.refunded}`); return Promise.resolve({ status: 'sent' }); },
  });
  script.done();
  assert.equal(result.status, 'refunded');
  assert.deepEqual(calls, ['refund:pi_1:admin_cancel', 'email:true']);
});

void test('a failed refund leaves the booking confirmed', async () => {
  const script = scripted([{ match: /SELECT \* FROM bookings/, rows: [booking] }]);
  const result = await cancelBooking(script.db, 'b1', true, {
    refund: () => Promise.reject(new Error('stripe down')),
    notify: () => Promise.resolve({ status: 'sent' }),
  });
  script.done();
  assert.equal(result.status, 'refund_failed');
});

void test('cancelling without refund, or a booking already handled', async () => {
  const script = scripted([
    { match: /SELECT \* FROM bookings/, rows: [booking] },
    { match: /UPDATE bookings/, rows: [{ ...booking, status: 'cancelled' }] },
    { match: /FROM sessions JOIN venues/, rows: [] },
  ]);
  let refunded = false;
  const result = await cancelBooking(script.db, 'b1', false, {
    refund: () => { refunded = true; return Promise.resolve({ id: 'x', status: 'succeeded' }); },
    notify: () => Promise.resolve({ status: 'sent' }),
  });
  script.done();
  assert.equal(result.status, 'cancelled');
  assert.equal(refunded, false);
  const done = scripted([{ match: /SELECT \* FROM bookings/, rows: [{ ...booking, status: 'refunded' }] }]);
  assert.equal((await cancelBooking(done.db, 'b1', true)).status, 'already_processed');
});

void test('cancellation email states the refund in both languages', () => {
  const email = renderAdminCancellationEmail({ booking, session: { date: '2026-10-22', start_time: '10:00', end_time: '11:00' }, venue: venues[0], refunded: true });
  assert.match(email.text, /£6\.30/);
  assert.match(email.text, /全额原路退回/);
});
