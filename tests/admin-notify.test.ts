import test from 'node:test';
import assert from 'node:assert/strict';
import { adminNotifyRecipients, renderAdminRequestNotificationEmail } from '../lib/server/email';
void test('admin recipient parsing trims, validates and deduplicates', () => {
  assert.deepEqual(adminNotifyRecipients(''), []);
  assert.deepEqual(adminNotifyRecipients(' a@example.com,invalid, A@example.com, b@example.com '), ['a@example.com', 'b@example.com']);
});
void test('admin notification HTML escapes user input', () => {
  const email = renderAdminRequestNotificationEmail('request', { name: '<script>alert(1)</script>' });
  assert.ok(email.html.includes('&lt;script&gt;'));
  assert.ok(!email.html.includes('<script>'));
});
