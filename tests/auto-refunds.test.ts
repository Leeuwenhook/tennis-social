import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAutoRefundDue, isLondonAutoRefundHour, processAutoRefunds, type AutoRefundOutcome } from '../lib/server/auto-refunds';
import { handleAutoRefundCron } from '../lib/server/auto-refund-cron';
import { renderAutoRefundEmail, type AutoRefundEmailInput } from '../lib/server/email';
import type { BookingRow, Database } from '../lib/server/database';
import { venues } from '../lib/demo-data';

// 18:00 London on a BST day.
const NOW = new Date('2026-10-20T17:00:00Z');

void test('refunds are decided 24–48 hours before the start, in London time', () => {
  assert.equal(isAutoRefundDue('2026-10-21', '17:59', NOW), false);
  assert.equal(isAutoRefundDue('2026-10-21', '18:00', NOW), true);
  assert.equal(isAutoRefundDue('2026-10-22', '17:59', NOW), true);
  assert.equal(isAutoRefundDue('2026-10-22', '18:00', NOW), false);
  assert.equal(isAutoRefundDue('bad', '18:00', NOW), false);
  assert.equal(isLondonAutoRefundHour(NOW), true);
  assert.equal(isLondonAutoRefundHour(new Date('2026-10-20T18:00:00Z')), false);
  assert.equal(isLondonAutoRefundHour(new Date('2026-12-01T18:00:00Z')), true);
});

const booking = {
  id: 'booking-1',
  session_id: 'session-1',
  contact_name: 'Ana',
  email: 'ana@example.com',
  participant_count: 1,
  total_pence: 630,
  status: 'confirmed',
  stripe_payment_intent_id: 'pi_1',
} as unknown as BookingRow;
const venueRow = {
  id: venues[0].id, name: venues[0].name, name_zh: venues[0].nameZh,
  area: venues[0].area, area_zh: venues[0].areaZh, photo: '', photos_json: '[]',
};
const session = { id: 'session-1', venue_id: venues[0].id, date: '2026-10-21', start_time: '19:00', end_time: '20:00' };

function scriptedDb(steps: Array<{ match: RegExp; rows: unknown[]; check?: (sql: string, params: unknown[]) => void }>) {
  let count = 0;
  const db = ((parts: TemplateStringsArray, ...params: unknown[]) => {
    const sql = parts.join('?').replace(/\s+/g, ' ');
    const step = steps[count++];
    assert.ok(step, `Unexpected query: ${sql}`);
    assert.match(sql, step.match);
    step.check?.(sql, params);
    return Promise.resolve(step.rows);
  }) as unknown as Database;
  return { db, done: () => assert.equal(count, steps.length) };
}

function deps(overrides: { refundFails?: boolean } = {}) {
  const calls = { refunds: [] as string[], customers: [] as AutoRefundEmailInput[], admin: [] as AutoRefundOutcome[][] };
  return {
    calls,
    deps: {
      refund: (input: { paymentIntentId: string; bookingId: string }) => {
        calls.refunds.push(input.paymentIntentId);
        return overrides.refundFails ? Promise.reject(new Error('stripe down')) : Promise.resolve({ id: 're_1', status: 'succeeded' });
      },
      notifyCustomer: (input: AutoRefundEmailInput) => {
        calls.customers.push(input);
        return Promise.resolve({ status: 'sent' as const });
      },
      notifyAdmin: (outcomes: AutoRefundOutcome[]) => {
        calls.admin.push(outcomes);
        return Promise.resolve({ status: 'sent' as const });
      },
    },
  };
}

void test('a lone paid booking is refunded, its places released and the session unpublished', async () => {
  const script = scriptedDb([
    {
      match: /FROM sessions LEFT JOIN bookings/,
      rows: [
        { ...session, players: 1, paid_players: 1 },
        { ...session, id: 'session-pair', players: 2, paid_players: 2 },
        { ...session, id: 'session-pending', players: 2, paid_players: 1 },
        { ...session, id: 'session-later', date: '2026-10-23', players: 1, paid_players: 1 },
      ],
      check: (sql) => assert.match(sql, /NOT sessions.marked_full/),
    },
    { match: /UPDATE bookings SET auto_refund_status = 'processing'/, rows: [booking], check: (_sql, params) => assert.equal(params[1], 'session-1') },
    { match: /SELECT \* FROM venues/, rows: [venueRow] },
    {
      match: /UPDATE bookings SET status = \?, .*WHERE id = \? AND status = 'confirmed'.*booked_spots/,
      rows: [],
      check: (_sql, params) => assert.equal(params[0], 'refunded'),
    },
    { match: /auto_refund_status = 'refunded'/, rows: [], check: (_sql, params) => assert.equal(params[1], 're_1') },
    { match: /UPDATE sessions SET status = 'draft'/, rows: [] },
  ]);
  const { calls, deps: injected } = deps();
  const result = await processAutoRefunds(script.db, NOW, injected);
  script.done();
  assert.deepEqual(result, { sessions: 1, refunded: 1, cancelled: 0, failed: 0 });
  assert.deepEqual(calls.refunds, ['pi_1']);
  assert.equal(calls.customers[0].refunded, true);
  assert.equal(calls.admin[0][0].status, 'refunded');
});

void test('a failed Stripe refund keeps the booking and the session published', async () => {
  const script = scriptedDb([
    { match: /FROM sessions LEFT JOIN bookings/, rows: [{ ...session, players: 1, paid_players: 1 }] },
    { match: /auto_refund_status = 'processing'/, rows: [booking] },
    { match: /SELECT \* FROM venues/, rows: [venueRow] },
    { match: /auto_refund_status = 'failed'/, rows: [] },
  ]);
  const { calls, deps: injected } = deps({ refundFails: true });
  const result = await processAutoRefunds(script.db, NOW, injected);
  script.done();
  assert.equal(result.failed, 1);
  assert.equal(calls.customers.length, 0);
  assert.equal(calls.admin[0][0].status, 'failed');
});

void test('a free booking is cancelled without calling Stripe', async () => {
  const script = scriptedDb([
    { match: /FROM sessions LEFT JOIN bookings/, rows: [{ ...session, players: 1, paid_players: 1 }] },
    { match: /auto_refund_status = 'processing'/, rows: [{ ...booking, total_pence: 0, stripe_payment_intent_id: null }] },
    { match: /SELECT \* FROM venues/, rows: [venueRow] },
    { match: /UPDATE bookings SET status = \?/, rows: [], check: (_sql, params) => assert.equal(params[0], 'cancelled') },
    { match: /auto_refund_status = 'refunded'/, rows: [] },
    { match: /UPDATE sessions SET status = 'draft'/, rows: [] },
  ]);
  const { calls, deps: injected } = deps();
  const result = await processAutoRefunds(script.db, NOW, injected);
  script.done();
  assert.equal(result.cancelled, 1);
  assert.deepEqual(calls.refunds, []);
  assert.equal(calls.customers[0].refunded, false);
});

void test('refund email states the amount in both languages', () => {
  const email = renderAutoRefundEmail({ booking, session, venue: venues[0], refunded: true });
  assert.match(email.text, /£6\.30/);
  assert.match(email.text, /全额原路退回/);
  assert.match(email.subject, /Refunded/);
});

void test('the cron requires its secret and only acts at 18:00 London', async () => {
  const previous = process.env.CRON_SECRET;
  const previousStripe = process.env.STRIPE_SECRET_KEY;
  process.env.CRON_SECRET = 'secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  try {
    const run = () => Promise.resolve({ sessions: 0, refunded: 0, cancelled: 0, failed: 0 });
    const url = 'https://example.com/api/cron/auto-refunds';
    assert.equal((await handleAutoRefundCron(new Request(url), NOW, run)).status, 401);
    const off = await handleAutoRefundCron(new Request(url, { headers: { authorization: 'Bearer secret' } }), new Date('2026-10-20T18:00:00Z'), run);
    assert.deepEqual(await off.json(), { skipped: 'outside_london_18h' });
    const on = await handleAutoRefundCron(new Request(url, { headers: { authorization: 'Bearer secret' } }), NOW, run);
    assert.equal(on.status, 200);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous;
    if (previousStripe === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previousStripe;
  }
});
