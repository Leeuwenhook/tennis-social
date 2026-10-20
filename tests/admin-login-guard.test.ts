import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clientIp,
  hashIp,
  isLoginLocked,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_ACCOUNT_IP,
  MAX_FAILURES_PER_IP,
} from '../lib/server/admin-login-guard';
import type { Database } from '../lib/server/database';

function dbReturning(counts: { accountIp?: number; account?: number; ip?: number }, seen: unknown[][] = []) {
  return ((parts: TemplateStringsArray, ...params: unknown[]) => {
    seen.push(params);
    assert.match(parts.join('?'), /NOT success AND \(created_at > \?/);
    return Promise.resolve([{ account_ip_failures: counts.accountIp ?? 0, account_failures: counts.account ?? 0, ip_failures: counts.ip ?? 0 }]);
  }) as unknown as Database;
}

void test('one username from one IP locks after a few failures', async () => {
  assert.equal(await isLoginLocked(dbReturning({ accountIp: MAX_FAILURES_PER_ACCOUNT_IP - 1, account: 4, ip: 4 }), 'admin', 'h'), false);
  assert.equal(await isLoginLocked(dbReturning({ accountIp: MAX_FAILURES_PER_ACCOUNT_IP, account: 5, ip: 5 }), 'admin', 'h'), true);
});

void test('a few failures elsewhere cannot lock the admin out, but a sustained attack can', async () => {
  // Five failures for this username from other IPs: this IP can still sign in.
  assert.equal(await isLoginLocked(dbReturning({ accountIp: 0, account: 5, ip: 0 }), 'admin', 'h'), false);
  assert.equal(await isLoginLocked(dbReturning({ accountIp: 0, account: MAX_FAILURES_PER_ACCOUNT }), 'admin', 'h'), true);
  // Another admin's typos on the same network do not lock this account.
  assert.equal(await isLoginLocked(dbReturning({ accountIp: 0, account: 0, ip: 5 }), 'admin', 'h'), false);
  assert.equal(await isLoginLocked(dbReturning({ ip: MAX_FAILURES_PER_IP }), 'admin', 'h'), true);
});

void test('the lock window is the last 15 minutes', async () => {
  const seen: unknown[][] = [];
  await isLoginLocked(dbReturning({}, seen), 'admin', 'h', new Date('2026-10-19T12:00:00Z'));
  assert.ok(seen[0].includes('2026-10-19T11:45:00.000Z'));
  assert.ok(seen[0].includes('2026-10-19T12:00:00.000Z'));
});

void test('client IPs come from the proxy header and are hashed', () => {
  assert.equal(clientIp(new Request('https://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } })), '1.2.3.4');
  assert.equal(clientIp(new Request('https://x')), 'unknown');
  assert.notEqual(hashIp('1.2.3.4'), '1.2.3.4');
  assert.equal(hashIp('1.2.3.4'), hashIp('1.2.3.4'));
});
