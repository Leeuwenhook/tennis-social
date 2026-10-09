import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { PATCH } from '../app/api/admin/reservation-requests/[id]/route';
import {
  ADMIN_COOKIE_NAME,
  createAdminSession,
} from '../lib/server/admin-auth';
import type { ReservationRequestRow } from '../lib/server/database';

const originalFetch = globalThis.fetch;
const envNames = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'ADMIN_USERNAME_2',
  'ADMIN_PASSWORD_2',
  'ADMIN_SESSION_SECRET',
] as const;
const savedEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);
let savedRow: ReservationRequestRow;
let databaseCalls = 0;

beforeEach(() => {
  process.env.DATABASE_URL =
    'postgresql://test:test@request-tests.neon.tech/testdb';
  process.env.ADMIN_USERNAME = 'test-admin';
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret';
  delete process.env.ADMIN_USERNAME_2;
  delete process.env.ADMIN_PASSWORD_2;
  databaseCalls = 0;
  savedRow = {
    id: 'request-test',
    request_type: 'known_venue',
    venue_id: null,
    venue_name: 'Victoria Park',
    postcode: '',
    preferred_date: '2026-12-20',
    start_time: '18:00',
    end_time: '20:00',
    contact_name: 'Test Player',
    email: 'test@example.com',
    phone: '',
    message: 'Two players',
    status: 'pending',
    created_at: '2026-10-01T12:00:00.000Z',
    updated_at: '2026-10-01T12:00:00.000Z',
  };
  globalThis.fetch = async (_url, init) => {
    databaseCalls += 1;
    assert.ok(typeof init?.body === 'string');
    const query = JSON.parse(init.body) as { params: string[] };
    const [status, updatedAt, id] = query.params;
    if (id === savedRow.id)
      savedRow = {
        ...savedRow,
        status: status as ReservationRequestRow['status'],
        updated_at: updatedAt,
      };
    return Response.json({
      fields: Object.keys(savedRow).map((name) => ({ name, dataTypeID: 25 })),
      rows: id === savedRow.id ? [Object.values(savedRow)] : [],
      rowCount: id === savedRow.id ? 1 : 0,
      command: 'UPDATE',
    });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

function request(body: unknown, authenticated = true) {
  return new Request(
    'http://localhost/api/admin/reservation-requests/request-test',
    {
      method: 'PATCH',
      headers: authenticated
        ? { cookie: `${ADMIN_COOKIE_NAME}=${createAdminSession('test-admin')}` }
        : {},
      body: JSON.stringify(body),
    },
  );
}

const context = { params: Promise.resolve({ id: 'request-test' }) };

void test('admins can cancel and reopen a request while preserving its details', async () => {
  for (const status of ['reviewing', 'completed', 'cancelled', 'pending']) {
    const response = await PATCH(request({ status }), context);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.request.status, status);
    assert.equal(savedRow.status, status);
    assert.equal(data.request.id, 'request-test');
    assert.equal(data.request.venueName, 'Victoria Park');
    assert.equal(data.request.message, 'Two players');
    assert.equal(data.request.createdAt, '2026-10-01T12:00:00.000Z');
    assert.notEqual(savedRow.updated_at, savedRow.created_at);
  }
  assert.equal(databaseCalls, 4);
});

void test('unauthenticated cancellation is rejected before accessing the database', async () => {
  const response = await PATCH(
    request({ status: 'cancelled' }, false),
    context,
  );
  assert.equal(response.status, 401);
  assert.equal(databaseCalls, 0);
});

void test('invalid states and malformed bodies cannot change a request', async () => {
  for (const body of [null, {}, { status: 'deleted' }, { status: 123 }]) {
    const response = await PATCH(request(body), context);
    assert.equal(response.status, 400);
  }
  assert.equal(savedRow.status, 'pending');
  assert.equal(databaseCalls, 0);
});

void test('cancelling a missing request returns 404', async () => {
  const response = await PATCH(request({ status: 'cancelled' }), {
    params: Promise.resolve({ id: 'missing' }),
  });
  assert.equal(response.status, 404);
  assert.equal(savedRow.status, 'pending');
});

void test('missing database configuration returns 503', async () => {
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  const response = await PATCH(request({ status: 'cancelled' }), context);
  assert.equal(response.status, 503);
  assert.equal(databaseCalls, 0);
});
