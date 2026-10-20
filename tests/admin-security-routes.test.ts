import { PATCH as applicationStatus } from '../app/api/admin/reservation-requests/[id]/applications/[applicationId]/route';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { ADMIN_COOKIE_NAME, adminUsername, createAdminSession, requireAdmin } from '../lib/server/admin-auth';
import { POST as login } from '../app/api/admin/auth/login/route';
import { PATCH as cancel } from '../app/api/admin/bookings/[id]/route';
import { PATCH as settings } from '../app/api/admin/settings/route';

const originalFetch = globalThis.fetch;
const keys = ['DATABASE_URL', 'POSTGRES_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_USERNAME_2', 'ADMIN_PASSWORD_2', 'ADMIN_SESSION_SECRET'] as const;
const env = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@login-test.neon.tech/db';
  process.env.ADMIN_USERNAME = 'alice'; process.env.ADMIN_PASSWORD = 'secret';
  process.env.ADMIN_USERNAME_2 = 'bob'; process.env.ADMIN_PASSWORD_2 = 'other';
  process.env.ADMIN_SESSION_SECRET = 'test-session-key';
  globalThis.fetch = async () => { assert.fail('Unexpected external call'); };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
});
function request(path: string, body: unknown, origin?: string, user = 'alice') {
  return new Request(`https://admin.test${path}`, {
    method: 'PATCH', body: JSON.stringify(body),
    headers: { cookie: `${ADMIN_COOKIE_NAME}=${createAdminSession(user)}`, ...(origin ? { origin } : {}) },
  });
}
void test('cross-origin writes, including sibling subdomains, are rejected before a database call', () => {
  for (const origin of ['https://attacker.test', 'https://sibling.admin.test', 'null']) {
    assert.equal(requireAdmin(request('/api/admin/sessions/s1', {}, origin))?.status, 403);
  }
  assert.equal(requireAdmin(request('/api/admin/sessions/s1', {}, 'https://admin.test')), null);
});
void test('admin identity comes from the verified account cookie; tampering cannot choose another actor', () => {
  assert.equal(adminUsername(request('/', {}, undefined, 'bob')), 'bob');
  const forged = new Request('https://admin.test', { headers: { cookie: `${ADMIN_COOKIE_NAME}=${createAdminSession('alice')}corrupt` } });
  assert.equal(adminUsername(forged), null);
});
void test('null cancellation/settings JSON returns 400 without contacting any service', async () => {
  assert.equal((await cancel(request('/api/admin/bookings/b1', null), { params: Promise.resolve({ id: 'b1' }) })).status, 400);
  assert.equal((await settings(request('/api/admin/settings', null))).status, 400);
});
void test('login fails closed if the attempts table is missing, and blocks cross-origin login', async () => {
  const req = () => new Request('https://admin.test/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ username: 'alice', password: 'secret' }) });
  globalThis.fetch = async () => { throw new Error('relation admin_login_attempts does not exist'); };
  assert.equal((await login(req())).status, 503);
  const other = req(); other.headers.set('origin', 'https://attacker.test');
  assert.equal((await login(other)).status, 403);
});
void test('login check and record share a transaction with locks before reading the counts', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(typeof init?.body, 'string');
    const body = JSON.parse(init!.body as string) as { queries: Array<{ query: string; params: unknown[] }> };
    assert.equal(body.queries.length, 3);
    assert.match(body.queries[0].query, /pg_advisory_xact_lock/);
    assert.match(body.queries[1].query, /pg_advisory_xact_lock/);
    assert.match(body.queries[2].query, /username = [\s\S]* OR ip_hash = /);
    assert.match(body.queries[2].query, /FROM guard WHERE NOT locked/);
    return Response.json({ results: [
      { fields: [], rows: [[]], rowCount: 1, command: 'SELECT' },
      { fields: [], rows: [[]], rowCount: 1, command: 'SELECT' },
      { fields: [{ name: 'locked', dataTypeID: 16 }], rows: [['t']], rowCount: 1, command: 'SELECT' },
    ] });
  };
  const response = await login(new Request('https://admin.test/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ username: 'alice', password: 'secret' }) }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('set-cookie'), null);
});

void test('application acceptance serializes capacity checks and rejects a lost last-place race', async () => {
  let transactions = 0;
  globalThis.fetch = async (_url, init) => {
    assert.equal(typeof init?.body, 'string');
    const body = JSON.parse(init!.body as string) as { query?: string; queries?: Array<{ query: string }> };
    if (!body.queries) {
      // The preflight sees a free place; another accept may win before the mutation.
      return Response.json({ fields: [{ name: 'status', dataTypeID: 25 }, { name: 'seeking_player_count', dataTypeID: 23 }, { name: 'accepted_count', dataTypeID: 23 }], rows: [['pending', '1', '0']], rowCount: 1, command: 'SELECT' });
    }
    transactions++;
    assert.match(body.queries[0].query, /pg_advisory_xact_lock/);
    assert.match(body.queries[1].query, /requests.status IN \('pending', 'reviewing'\)/);
    assert.match(body.queries[1].query, /COUNT\(\*\) FROM partner_request_applications/);
    assert.match(body.queries[1].query, /INSERT INTO admin_audit_log/);
    return Response.json({ results: [
      { fields: [], rows: [], rowCount: 1, command: 'SELECT' },
      { fields: [], rows: [], rowCount: 0, command: 'UPDATE' },
    ] });
  };
  const response = await applicationStatus(request('/api/admin/reservation-requests/r1/applications/a1', { status: 'accepted' }), { params: Promise.resolve({ id: 'r1', applicationId: 'a1' }) });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'request_full');
  assert.equal(transactions, 1);
});
