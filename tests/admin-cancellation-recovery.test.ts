import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cancelBooking, notifyCancellationOnce } from '../lib/server/admin-cancel-booking';
import type { BookingRow, Database } from '../lib/server/database';

const booking = { id: 'b1', session_id: 's1', contact_name: 'Ana', email: 'a@x', status: 'confirmed', total_pence: 630, stripe_payment_intent_id: 'pi_1', participant_count: 1 } as BookingRow;
const command = { booking_id: 'b1', refund: true, actor: 'alice', completed_at: null };
const details = { name: 'Park', name_zh: '公园', area: 'London', area_zh: '伦敦', photo: '', photos_json: '[]', date: '2026-10-22', start_time: '10:00', end_time: '11:00' };
function script(steps: Array<{ sql: RegExp; rows?: unknown[]; check?: (params: unknown[]) => void; error?: Error }>) {
  let count = 0;
  const db = ((parts: TemplateStringsArray, ...params: unknown[]) => {
    const sql = parts.join('?').replace(/\s+/g, ' ');
    const step = steps[count++];
    assert.ok(step, `Unexpected SQL ${sql}`);
    assert.match(sql, step.sql);
    step.check?.(params);
    if (step.error) return Promise.reject(step.error);
    return Promise.resolve(step.rows ?? []);
  }) as unknown as Database;
  return { db, done: () => assert.equal(count, steps.length) };
}
const start = (row = booking, cmd: unknown = command) => [
  { sql: /SELECT \* FROM bookings/, rows: [row] },
  { sql: /INSERT INTO admin_booking_cancellations.*status = 'confirmed'.*ON CONFLICT.*DO NOTHING/ },
  { sql: /SELECT \* FROM admin_booking_cancellations/, rows: cmd ? [cmd] : [] },
];
const finalize = { sql: /WITH command AS.*completed_at IS NULL.*FOR UPDATE.*target.status = 'confirmed'.*INSERT INTO admin_audit_log/ };
const readRefunded = { sql: /SELECT \* FROM bookings/, rows: [{ ...booking, status: 'refunded' }] };
const claim = { sql: /UPDATE admin_booking_cancellations.*email_status = 'sending'.*completed_at IS NOT NULL/, rows: [{ booking_id: 'b1' }] };
const loadDetails = { sql: /FROM sessions JOIN venues/, rows: [details] };
const sent = { sql: /SET email_status = 'sent'.*email_claim = \?/ };
const reset = { sql: /SET email_status = 'pending'.*email_claim = \?/ };

void test('refund success, booking transition, seat release and audit precede cancellation email', async () => {
  const s = script([...start(), finalize, readRefunded, claim, loadDetails, sent]);
  const calls: string[] = [];
  const result = await cancelBooking(s.db, 'b1', true, {
    refund: async () => { calls.push('refund'); return { id: 're1', status: 'succeeded' }; },
    notify: async ({ booking: row, refunded }) => { assert.equal(row.status, 'refunded'); assert.equal(refunded, true); calls.push('email'); return { status: 'sent' }; },
  }, 'alice');
  assert.equal(result.status, 'refunded');
  assert.equal('emailPending' in result && result.emailPending, false);
  assert.deepEqual(calls, ['refund', 'email']);
  s.done();
});

void test('HTTP-successful pending/failed refunds must not cancel bookings or release seats', async () => {
  for (const status of ['pending', 'failed', 'canceled']) {
    const s = script(start());
    assert.equal((await cancelBooking(s.db, 'b1', true, {
      refund: async () => ({ id: 're1', status }),
      notify: async () => { assert.fail('must not email'); },
    })).status, 'refund_failed');
    s.done();
  }
});

void test('refund failure preserves a resumable command and does not mutate the booking', async () => {
  const s = script(start());
  assert.equal((await cancelBooking(s.db, 'b1', true, {
    refund: async () => { throw new Error('offline'); }, notify: async () => { assert.fail('must not email'); },
  })).status, 'refund_failed');
  s.done();
});

void test('a webhook winning the race can be recovered, preserving the original refund choice', async () => {
  const s = script([...start({ ...booking, status: 'refunded' }), finalize, readRefunded, claim, loadDetails, sent]);
  let refunds = 0;
  const result = await cancelBooking(s.db, 'b1', false, {
    refund: async () => { refunds++; return { id: 'same-idempotent-refund', status: 'succeeded' }; },
    notify: async () => ({ status: 'sent' }),
  });
  assert.equal(result.status, 'refunded');
  assert.equal(refunds, 0);
  s.done();
});

void test('failed delivery is visible and retried after cancellation without another refund', async () => {
  const s = script([...start(), finalize, readRefunded, claim, loadDetails, reset]);
  const result = await cancelBooking(s.db, 'b1', true, {
    refund: async () => ({ id: 're1', status: 'succeeded' }), notify: async () => ({ status: 'skipped' }),
  });
  assert.equal('emailPending' in result && result.emailPending, true);
  s.done();
  const retry = script([...start({ ...booking, status: 'refunded' }, { ...command, completed_at: 'done' }), readRefunded, claim, loadDetails, sent]);
  const recovered = await cancelBooking(retry.db, 'b1', true, {
    refund: async () => { assert.fail('must not refund again'); }, notify: async () => ({ status: 'sent' }),
  });
  assert.equal('emailPending' in recovered && recovered.emailPending, false);
  retry.done();
});

void test('concurrent email delivery cannot claim a sending/sent notification twice', async () => {
  const s = script([{ ...claim, rows: [] }, { sql: /SELECT email_status/, rows: [{ email_status: 'sent' }] }]);
  assert.equal(await notifyCancellationOnce(s.db, { ...booking, status: 'refunded' }, async () => { assert.fail('duplicate email'); }), true);
  s.done();
});

void test('terminal bookings without an admin command cannot start a new refund', async () => {
  const s = script(start({ ...booking, status: 'refunded' }, null));
  assert.equal((await cancelBooking(s.db, 'b1', true)).status, 'already_processed');
  s.done();
});

void test('a non-refund command remains non-refunding on retry, and a free booking never calls Stripe', async () => {
  for (const row of [booking, { ...booking, total_pence: 0, stripe_payment_intent_id: null }]) {
    const s = script([...start(row, { ...command, refund: false }), finalize,
      { sql: /SELECT \* FROM bookings/, rows: [{ ...row, status: 'cancelled' }] }, claim, loadDetails, sent]);
    const result = await cancelBooking(s.db, 'b1', true, {
      refund: async () => { assert.fail('must not change the original refund choice'); },
      notify: async ({ refunded }) => { assert.equal(refunded, false); return { status: 'sent' }; },
    });
    assert.equal(result.status, 'cancelled');
    s.done();
  }
});

void test('a database failure after Stripe success is recoverable after a webhook and a page reload', async () => {
  let refunds = 0;
  const first = script([...start(), { ...finalize, error: new Error('database unavailable after Stripe success') }]);
  await assert.rejects(cancelBooking(first.db, 'b1', true, {
    refund: async () => { refunds++; return { id: 're1', status: 'succeeded' }; },
    notify: async () => { assert.fail('must wait for database completion'); },
  }), /database unavailable/);
  first.done();
  const resumed = script([...start({ ...booking, status: 'refunded' }), finalize, readRefunded, claim, loadDetails, sent]);
  const result = await cancelBooking(resumed.db, 'b1', true, {
    refund: async () => { assert.fail('webhook already established the refund'); },
    notify: async () => ({ status: 'sent' }),
  });
  assert.equal(result.status, 'refunded');
  assert.equal(refunds, 1);
  resumed.done();
});
