import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { PATCH } from '../app/api/admin/sessions/[id]/route';
import { ADMIN_COOKIE_NAME, createAdminSession } from '../lib/server/admin-auth';

const originalFetch = globalThis.fetch;
const envNames = ['DATABASE_URL', 'POSTGRES_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET'] as const;
const savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

const sessionFields = [
  ['id', 25], ['venue_id', 25], ['date', 25], ['start_time', 25], ['end_time', 25], ['price_pence', 23],
  ['capacity', 23], ['booked_spots', 23], ['marked_full', 16], ['formats_json', 25], ['seeking_levels_json', 25], ['status', 25],
] as const;
// The flag the first SELECT saw, and the flag stored when the UPDATE runs (another admin changed it in between).
let staleFlag = false;
let storedFlag = false;

function sessionRow(markedFull: boolean) {
  return ['session-1', 'venue-1', '2026-11-01', '16:00', '17:00', '800', '4', '0', markedFull ? 't' : 'f', '["doubles"]', '[]', 'published'];
}

function result(fields: ReadonlyArray<readonly [string, number]>, rows: string[][]) {
  return Response.json({ fields: fields.map(([name, dataTypeID]) => ({ name, dataTypeID })), rows, rowCount: rows.length, command: 'SELECT' });
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@session-tests.neon.tech/testdb';
  process.env.ADMIN_USERNAME = 'test-admin';
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret';
  globalThis.fetch = async (_url, init) => {
    assert.ok(typeof init?.body === 'string');
    const { query, params } = JSON.parse(init.body) as { query: string; params: unknown[] };
    if (query.includes('COUNT(*)')) return result([['count', 23]], [['1']]);
    if (query.includes('FROM venues')) return result([['id', 25], ['name', 25], ['name_zh', 25]], [['venue-1', 'Park', '公园']]);
    if (query.includes('participant_count')) return result([['participant_count', 23]], [['0']]);
    if (query.trimStart().startsWith('SELECT')) return result(sessionFields, [sessionRow(staleFlag)]);
    const match = /marked_full = COALESCE\(\$(\d+)::boolean, marked_full\)/.exec(query);
    assert.ok(match, 'UPDATE must keep the stored flag when none is supplied');
    const supplied = params[Number(match[1]) - 1];
    storedFlag = supplied === null ? storedFlag : supplied === true || supplied === 'true';
    return result(sessionFields, [sessionRow(storedFlag)]);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

const context = { params: Promise.resolve({ id: 'session-1' }) };
const body = { venueId: 'venue-1', date: '2026-11-01', startTime: '16:00', endTime: '17:00', pricePence: 800, capacity: 4, formats: ['doubles'], status: 'published' };

function patch(payload: unknown) {
  return PATCH(new Request('http://localhost/api/admin/sessions/session-1', {
    method: 'PATCH',
    headers: { cookie: `${ADMIN_COOKIE_NAME}=${createAdminSession('test-admin')}` },
    body: JSON.stringify(payload),
  }), context);
}

void test('an edit without markedFull keeps a flag another admin set after it was read', async () => {
  staleFlag = false;
  storedFlag = true;
  const response = await patch(body);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).session.markedFull, true);
  assert.equal(storedFlag, true);
});

void test('an explicit markedFull marks and reopens the session', async () => {
  staleFlag = false;
  storedFlag = false;
  assert.equal((await (await patch({ ...body, markedFull: true })).json()).session.markedFull, true);
  assert.equal((await (await patch({ ...body, markedFull: false })).json()).session.markedFull, false);
});
