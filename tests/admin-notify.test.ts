import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminNotifyRecipients,
  renderAdminRequestNotificationEmail,
} from '../lib/server/email';
void test('admin recipient parsing trims, validates and deduplicates', () => {
  assert.deepEqual(adminNotifyRecipients(''), [
    'una.ge2502@gmail.com',
    'leeuwenhook.sun@gmail.com',
  ]);
  assert.deepEqual(adminNotifyRecipients('  '), adminNotifyRecipients(''));
  assert.deepEqual(adminNotifyRecipients('invalid'), []);
  assert.deepEqual(
    adminNotifyRecipients(
      ' a@example.com,invalid, A@example.com, b@example.com ',
    ),
    ['a@example.com', 'b@example.com'],
  );
});
void test('admin notification HTML escapes user input', () => {
  const email = renderAdminRequestNotificationEmail('request', {
    name: '<script>alert(1)</script>',
  });
  assert.ok(email.html.includes('&lt;script&gt;'));
  assert.ok(!email.html.includes('<script>'));
});

void test('admin booking notification swallows database failures and guards claim ownership', async () => {
  const { sendAdminBookingNotificationOnce } =
    await import('../lib/server/booking-email');
  const previous = {
    ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };
  Object.assign(process.env, {
    ADMIN_NOTIFY_EMAIL: 'admin@example.com',
    SMTP_USER: 'test',
    SMTP_PASSWORD: 'test',
    EMAIL_FROM: 'test@example.com',
  });
  try {
    const queries: string[] = [];
    const db = ((parts: TemplateStringsArray) => {
      const sql = parts.join('?');
      queries.push(sql);
      if (queries.length === 1) {
        return Promise.reject(new Error('database unavailable'));
      }
      return Promise.resolve([]);
    }) as unknown as import('../lib/server/database').Database;
    assert.equal(
      (await sendAdminBookingNotificationOnce(db, 'test-booking')).status,
      'failed',
    );
    assert.equal(queries.length, 2);
    assert.match(queries[0], /status = 'confirmed'/);
    assert.match(queries[0], /admin_notification_status = 'pending'/);
    assert.match(queries[0], /admin_notification_claimed_at </);
    assert.match(queries[1], /admin_notification_claimed_at = \?/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
void test('admin booking notification sends nothing when another worker owns the claim', async () => {
  const { sendAdminBookingNotificationOnce } =
    await import('../lib/server/booking-email');
  const previous = {
    ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };
  Object.assign(process.env, {
    ADMIN_NOTIFY_EMAIL: 'admin@example.com',
    SMTP_USER: 'test',
    SMTP_PASSWORD: 'test',
    EMAIL_FROM: 'test@example.com',
  });
  try {
    let calls = 0;
    const db = (() => {
      calls++;
      return Promise.resolve([]);
    }) as unknown as import('../lib/server/database').Database;
    assert.equal(
      (await sendAdminBookingNotificationOnce(db, 'test-booking')).status,
      'not_applicable',
    );
    assert.equal(calls, 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

void test('admin notifications default to both owners when the env override is unset', () => {
  const original = process.env.ADMIN_NOTIFY_EMAIL;
  try {
    delete process.env.ADMIN_NOTIFY_EMAIL;
    assert.deepEqual(adminNotifyRecipients(), [
      'una.ge2502@gmail.com',
      'leeuwenhook.sun@gmail.com',
    ]);
    process.env.ADMIN_NOTIFY_EMAIL = 'override@example.com';
    assert.deepEqual(adminNotifyRecipients(), ['override@example.com']);
  } finally {
    if (original === undefined) delete process.env.ADMIN_NOTIFY_EMAIL;
    else process.env.ADMIN_NOTIFY_EMAIL = original;
  }
});
