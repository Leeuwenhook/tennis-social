import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIp, hashIp, isLoginLocked, MAX_FAILURES_PER_ACCOUNT, MAX_FAILURES_PER_IP } from '../lib/server/admin-login-guard';
import type { Database } from '../lib/server/database';

function dbReturning(accountFailures: number, ipFailures: number, seen: unknown[][] = []) {
  return ((parts: TemplateStringsArray, ...params: unknown[]) => {
    seen.push(params);
    assert.match(parts.join('?'), /NOT success AND \(created_at > \?/);
    return Promise.resolve([{ account_failures: accountFailures, ip_failures: ipFailures }]);
  }) as unknown as Database;
}

void test('logins lock after repeated failures for one account or one IP', async () => {
  assert.equal(await isLoginLocked(dbReturning(MAX_FAILURES_PER_ACCOUNT - 1, 4), 'admin', 'h'), false);
  assert.equal(await isLoginLocked(dbReturning(MAX_FAILURES_PER_ACCOUNT, 5), 'admin', 'h'), true);
  assert.equal(await isLoginLocked(dbReturning(0, MAX_FAILURES_PER_IP), 'admin', 'h'), true);
});

void test('the lock window is the last 15 minutes', async () => {
  const seen: unknown[][] = [];
  await isLoginLocked(dbReturning(0, 0, seen), 'admin', 'h', new Date('2026-10-19T12:00:00Z'));
  assert.ok(seen[0].includes('2026-10-19T11:45:00.000Z'));
  assert.ok(seen[0].includes('2026-10-19T12:00:00.000Z'));
});

void test('client IPs come from the proxy header and are hashed', () => {
  assert.equal(clientIp(new Request('https://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } })), '1.2.3.4');
  assert.equal(clientIp(new Request('https://x')), 'unknown');
  assert.notEqual(hashIp('1.2.3.4'), '1.2.3.4');
  assert.equal(hashIp('1.2.3.4'), hashIp('1.2.3.4'));
});
