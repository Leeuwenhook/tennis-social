import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isFollowupDue,
  isLondonFollowupHour,
  sendDueBookingFollowups,
} from '../lib/server/booking-followups';
import { handleBookingFollowupCron } from '../lib/server/booking-followup-cron';
import {
  renderBookingFollowupEmail,
  type BookingFollowupInput,
} from '../lib/server/email';
import type { BookingRow, Database } from '../lib/server/database';
import { venues } from '../lib/demo-data';

void test('follow-ups wait a full hour in BST and GMT, including midnight and cross-day sessions', () => {
  assert.equal(
    isFollowupDue('2026-07-01', '20:00', new Date('2026-07-01T19:59:59Z')),
    false,
  );
  assert.equal(
    isFollowupDue('2026-07-01', '20:00', new Date('2026-07-01T20:00:00Z')),
    true,
  );
  assert.equal(
    isFollowupDue('2026-12-01', '20:00', new Date('2026-12-01T20:59:59Z')),
    false,
  );
  assert.equal(
    isFollowupDue('2026-12-01', '20:00', new Date('2026-12-01T21:00:00Z')),
    true,
  );
  assert.equal(
    isFollowupDue('2026-07-01', '24:00', new Date('2026-07-02T00:00:00Z')),
    true,
  );
  assert.equal(
    isFollowupDue('2026-12-01', '24:00', new Date('2026-12-02T01:00:00Z')),
    true,
  );
  assert.equal(
    isFollowupDue('2026-12-01', '23:30', new Date('2026-12-02T00:29:00Z')),
    false,
  );
  assert.equal(
    isFollowupDue('2026-12-01', '23:30', new Date('2026-12-02T00:30:00Z')),
    true,
  );
  assert.equal(
    isFollowupDue('2026-12-01', '20:00', new Date('2026-12-05T21:00:00Z')),
    false,
  );
  assert.equal(isFollowupDue('bad-date', '24:00', new Date()), false);
  assert.equal(isFollowupDue('2026-12-01', '25:00', new Date()), false);
});
void test('DST changes use elapsed time and the later repeated autumn hour', () => {
  assert.equal(
    isFollowupDue('2026-03-29', '00:30', new Date('2026-03-29T01:29:59Z')),
    false,
  );
  assert.equal(
    isFollowupDue('2026-03-29', '00:30', new Date('2026-03-29T01:30:00Z')),
    true,
  );
  assert.equal(
    isFollowupDue('2026-10-25', '01:30', new Date('2026-10-25T02:29:59Z')),
    false,
  );
  assert.equal(
    isFollowupDue('2026-10-25', '01:30', new Date('2026-10-25T02:30:00Z')),
    true,
  );
});

function emailEnv() {
  const values = {
    SMTP_USER: 'test',
    SMTP_PASSWORD: 'test',
    EMAIL_FROM: 'test@example.com',
    REVIEW_TOKEN_SECRET: 'test-secret-with-at-least-32-bytes-long',
  };
  const original = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, values);
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}
const booking = {
  id: 'test-booking',
  session_id: 'test-session',
  status: 'confirmed',
  email: 'player@example.com',
  contact_name: '<script>Player</script>',
  venue_id: venues[0].id,
  date: '2026-12-01',
  start_time: '18:00',
  end_time: '20:00',
} as unknown as BookingRow & {
  venue_id: string;
  date: string;
  start_time: string;
  end_time: string;
};
const venueRow = {
  id: venues[0].id,
  name: venues[0].name,
  name_zh: venues[0].nameZh,
  area: venues[0].area,
  area_zh: venues[0].areaZh,
  photo: '',
  photos_json: '[]',
};

function scriptedDb(
  steps: Array<{
    match: RegExp;
    rows: unknown[];
    check?: (sql: string, params: unknown[]) => void;
  }>,
) {
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
void test('follow-up claims are guarded; a lost claim never sends mail', async () => {
  const restore = emailEnv();
  try {
    const script = scriptedDb([
      {
        match: /SELECT bookings/,
        rows: [booking],
        check: (sql) => {
          assert.match(sql, /bookings.status = 'confirmed'/);
          assert.match(sql, /NOT EXISTS .*email_suppressions/);
          assert.match(sql, /BETWEEN/);
        },
      },
      {
        match: /UPDATE bookings/,
        rows: [],
        check: (sql) => {
          assert.match(sql, /status = 'confirmed'/);
          assert.match(sql, /NOT EXISTS/);
          assert.match(sql, /followup_email_status = 'pending'/);
          assert.match(sql, /followup_email_claimed_at < /);
        },
      },
    ]);
    const result = await sendDueBookingFollowups(
      script.db,
      new Date('2026-12-01T21:00Z'),
      () => {
        throw new Error('must not send');
      },
    );
    assert.equal(result.skipped, 1);
    script.done();
  } finally {
    restore();
  }
});
void test('suppression or refund after a claim prevents sending', async () => {
  const restore = emailEnv();
  try {
    const script = scriptedDb([
      { match: /SELECT bookings/, rows: [booking] },
      { match: /UPDATE bookings/, rows: [booking] },
      { match: /SELECT \* FROM venues/, rows: [venueRow] },
      {
        match: /FROM sessions JOIN venues/,
        rows: [],
        check: (sql) => {
          assert.match(sql, /sessions.status = 'published'/);
          assert.match(sql, /sessions.booked_spots < sessions.capacity/);
          assert.match(sql, /NOT sessions.marked_full/);
          assert.match(sql, /LIMIT 3/);
        },
      },
      {
        match: /SELECT id FROM bookings/,
        rows: [],
        check: (sql) =>
          assert.match(
            sql,
            /status = 'confirmed'.*NOT EXISTS.*email_suppressions/,
          ),
      },
      { match: /followup_email_status = 'skipped'/, rows: [] },
    ]);
    const result = await sendDueBookingFollowups(
      script.db,
      new Date('2026-12-01T21:00Z'),
      () => {
        throw new Error('must not send');
      },
    );
    assert.equal(result.skipped, 1);
    script.done();
  } finally {
    restore();
  }
});
void test('successful delivery saves sent state and a later run does not send again', async () => {
  const restore = emailEnv();
  try {
    const script = scriptedDb([
      { match: /SELECT bookings/, rows: [booking] },
      { match: /UPDATE bookings/, rows: [booking] },
      { match: /SELECT \* FROM venues/, rows: [venueRow] },
      { match: /FROM sessions JOIN venues/, rows: [] },
      { match: /SELECT id FROM bookings/, rows: [{ id: booking.id }] },
      {
        match: /UPDATE bookings SET followup_email_status/,
        rows: [],
        check: (sql, params) => {
          assert.equal(params[0], 'sent');
          assert.match(sql, /followup_email_claimed_at = \?/);
        },
      },
      { match: /SELECT bookings/, rows: [] },
    ]);
    let calls = 0;
    const send = async (input: BookingFollowupInput) => {
      calls++;
      assert.ok(input.unsubscribeUrl.includes('/api/email/unsubscribe?t='));
      assert.equal(input.reviewUrl, undefined);
      return { status: 'sent' as const, messageId: 'test-message' };
    };
    assert.equal(
      (
        await sendDueBookingFollowups(
          script.db,
          new Date('2026-12-01T21:00Z'),
          send,
        )
      ).sent,
      1,
    );
    assert.equal(
      (
        await sendDueBookingFollowups(
          script.db,
          new Date('2026-12-01T21:00Z'),
          send,
        )
      ).sent,
      0,
    );
    assert.equal(calls, 1);
    script.done();
  } finally {
    restore();
  }
});
void test('follow-up cron rejects unauthenticated calls before database access', async () => {
  const original = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'test-cron';
    assert.equal(
      (await handleBookingFollowupCron(new Request('https://example.com')))
        .status,
      401,
    );
    delete process.env.CRON_SECRET;
    assert.equal(
      (await handleBookingFollowupCron(new Request('https://example.com')))
        .status,
      503,
    );
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});
void test('follow-up preview hides unavailable reviews, caps recommendations and escapes HTML', () => {
  const input: BookingFollowupInput = {
    booking,
    session: booking,
    venue: venues[0],
    unsubscribeUrl: 'https://example.com/unsubscribe?t=test',
    nextSessions: Array.from({ length: 4 }, (_, index) => ({
      id: String(index),
      date: '2026-12-02',
      start_time: '18:00',
      end_time: '20:00',
      name: 'Park',
      name_zh: '公园',
    })),
  };
  const email = renderBookingFollowupEmail(input);
  assert.ok(!email.html.includes('<script>'));
  assert.ok(email.html.includes('&lt;script&gt;'));
  assert.ok(!email.html.includes('Leave a review'));
  assert.ok(email.html.includes('Unsubscribe'));
  assert.equal((email.html.match(/view=detail/g) ?? []).length, 3);
  assert.match(email.subject, /^Thanks for playing · /);
  assert.ok(!/[\u4e00-\u9fff]/.test(email.html + email.text + email.subject));
});

void test('delivery failures release only the owned claim for retry', async () => {
  const restore = emailEnv();
  try {
    const script = scriptedDb([
      { match: /SELECT bookings/, rows: [booking] },
      { match: /UPDATE bookings/, rows: [booking] },
      { match: /SELECT \* FROM venues/, rows: [venueRow] },
      { match: /FROM sessions JOIN venues/, rows: [] },
      { match: /SELECT id FROM bookings/, rows: [{ id: booking.id }] },
      {
        match: /followup_email_status = 'pending'/,
        rows: [],
        check: (sql) => assert.match(sql, /followup_email_claimed_at = \?/),
      },
    ]);
    const result = await sendDueBookingFollowups(
      script.db,
      new Date('2026-12-01T21:00Z'),
      () => Promise.reject(new Error('SMTP unavailable')),
    );
    assert.equal(result.failed, 1);
    script.done();
  } finally {
    restore();
  }
});
void test('a session inside the wait period never acquires a delivery claim', async () => {
  const restore = emailEnv();
  try {
    const script = scriptedDb([{ match: /SELECT bookings/, rows: [booking] }]);
    const result = await sendDueBookingFollowups(
      script.db,
      new Date('2026-12-01T20:59Z'),
      () => {
        throw new Error('must not send');
      },
    );
    assert.equal(result.skipped, 1);
    script.done();
  } finally {
    restore();
  }
});

void test('the single 21:00 UTC cron falls inside the London 21h–22h window throughout BST/GMT', async () => {
  const { readFileSync } = await import('node:fs');
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(
    config.crons
      .filter(
        (cron: { path: string }) => cron.path === '/api/cron/session-followups',
      )
      .map((cron: { schedule: string }) => cron.schedule),
    ['0 21 * * *'],
  );
  for (const [date, expected20, expected21] of [
    ['2026-07-01', true, true],
    ['2026-12-01', false, true],
    ['2026-03-29', true, true],
    ['2026-10-25', false, true],
  ] as const) {
    for (const minute of ['00', '59']) {
      assert.equal(
        isLondonFollowupHour(new Date(`${date}T20:${minute}:00Z`)),
        expected20,
      );
      assert.equal(
        isLondonFollowupHour(new Date(`${date}T21:${minute}:00Z`)),
        expected21,
      );
    }
  }
});

void test('cron gates before work and force only bypasses the hour after CRON_SECRET authorization', async () => {
  const original = process.env.CRON_SECRET;
  let calls = 0;
  const run = async () => {
    calls++;
    return {
      status: 'sent' as const,
      candidates: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    };
  };
  try {
    process.env.CRON_SECRET = 'test-cron';
    const request = (force: boolean, authorized = true) =>
      new Request(
        `https://example.com/api/cron/session-followups${force ? '?force=1' : ''}`,
        { headers: authorized ? { authorization: 'Bearer test-cron' } : {} },
      );
    const outside = new Date('2026-12-01T20:30:00Z');
    const skipped = await handleBookingFollowupCron(
      request(false),
      outside,
      run,
    );
    assert.equal(skipped.status, 200);
    assert.deepEqual(await skipped.json(), { skipped: 'outside_london_21h_22h' });
    assert.equal(calls, 0);
    assert.equal(
      (await handleBookingFollowupCron(request(true, false), outside, run))
        .status,
      401,
    );
    assert.equal(calls, 0);
    assert.equal(
      (await handleBookingFollowupCron(request(true), outside, run)).status,
      200,
    );
    assert.equal(calls, 1);
    for (const now of ['2026-07-01T20:59:00Z', '2026-12-01T21:59:00Z'])
      assert.equal(
        (await handleBookingFollowupCron(request(false), new Date(now), run))
          .status,
        200,
      );
    assert.equal(calls, 3);
    delete process.env.CRON_SECRET;
    assert.equal(
      (await handleBookingFollowupCron(request(true), outside, run)).status,
      503,
    );
    assert.equal(calls, 3);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});

void test('follow-up window includes exactly 72 hours, excludes older sessions', () => {
  assert.equal(
    isFollowupDue('2026-12-01', '21:00', new Date('2026-12-04T21:00:00Z')),
    true,
  );
  assert.equal(
    isFollowupDue('2026-12-01', '21:00', new Date('2026-12-04T21:00:00.001Z')),
    false,
  );
});
