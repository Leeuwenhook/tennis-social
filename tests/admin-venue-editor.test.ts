import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { PATCH } from '../app/api/admin/venues/[id]/route';
import { POST as ARCHIVE } from '../app/api/admin/venues/[id]/archive/route';
import { ADMIN_COOKIE_NAME, createAdminSession } from '../lib/server/admin-auth';
import { venueInputIssues } from '../lib/server/admin-validation';
import { undoAdminAction, VENUE_FIELDS } from '../lib/server/audit-log';
import type { Database } from '../lib/server/database';

const valid = { name: 'Park', nameZh: '公园', area: 'Hackney', areaZh: '哈克尼', photos: ['/a.jpg'], peakPricePence: 1200, offPeakPricePence: 800 };

void test('venue input issues name each bad field', () => {
  assert.deepEqual(venueInputIssues(valid), []);
  assert.deepEqual(venueInputIssues({ ...valid, courtCount: null, courtSetting: null, floodlights: null }), []);
  assert.deepEqual(venueInputIssues({ ...valid, courtCount: 6, courtSetting: 'indoor', floodlights: true }), []);
  assert.deepEqual(venueInputIssues({ ...valid, name: ' ', areaZh: '' }), ['name', 'area']);
  assert.deepEqual(venueInputIssues({ ...valid, photos: [], photo: '' }), ['photos']);
  assert.deepEqual(venueInputIssues({ ...valid, photos: ['javascript:alert(1)'] }), ['photos']);
  assert.deepEqual(venueInputIssues({ ...valid, peakPricePence: 700 }), ['priceOrder']);
  assert.deepEqual(venueInputIssues({ ...valid, peakPricePence: -1, offPeakPricePence: 1.5 }), ['peakPrice', 'offPeakPrice']);
  assert.deepEqual(venueInputIssues({ ...valid, peakPricePence: 100_001 }), ['peakPrice']);
  for (const courtCount of [0, 101, 2.5, '4']) assert.deepEqual(venueInputIssues({ ...valid, courtCount }), ['courtCount']);
  assert.deepEqual(venueInputIssues({ ...valid, courtCount: 1 }), []);
  assert.deepEqual(venueInputIssues({ ...valid, courtCount: 100 }), []);
  assert.deepEqual(venueInputIssues({ ...valid, courtSetting: 'clay' }), ['courtSetting']);
  assert.deepEqual(venueInputIssues({ ...valid, floodlights: 'yes' }), ['floodlights']);
});

const venueFields = [
  ['id', 25], ['name', 25], ['name_zh', 25], ['area', 25], ['area_zh', 25], ['photo', 25], ['notes', 25], ['description', 25],
  ['description_zh', 25], ['peak_price_pence', 23], ['off_peak_price_pence', 23], ['photos_json', 25], ['address', 25], ['address_zh', 25],
  ['postcode', 25], ['court_count', 23], ['court_setting', 25], ['floodlights', 16], ['archived_at', 25], ['created_at', 25], ['updated_at', 25],
] as const;
const STORED_UPDATED_AT = '2026-10-20T09:00:00.000Z';
let venueExists = true;
let raceLost = false;
let lastMutation: { query: string; params: unknown[] } | null = null;

function venueRow(overrides: Record<string, string | null> = {}) {
  const row: Record<string, string | null> = {
    id: 'venue-1', name: 'Park', name_zh: '公园', area: 'Hackney', area_zh: '哈克尼', photo: '/a.jpg', notes: '', description: null,
    description_zh: null, peak_price_pence: '1200', off_peak_price_pence: '800', photos_json: '["/a.jpg"]', address: '', address_zh: '',
    postcode: '', court_count: '4', court_setting: 'outdoor', floodlights: 't', archived_at: null, created_at: STORED_UPDATED_AT, updated_at: STORED_UPDATED_AT,
    ...overrides,
  };
  return venueFields.map(([name]) => row[name]);
}

function result(rows: Array<Array<string | null>>) {
  return Response.json({ fields: venueFields.map(([name, dataTypeID]) => ({ name, dataTypeID })), rows, rowCount: rows.length, command: 'SELECT' });
}

const envNames = ['DATABASE_URL', 'POSTGRES_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET'] as const;
const savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@venue-tests.neon.tech/testdb';
  process.env.ADMIN_USERNAME = 'test-admin';
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret';
  venueExists = true; raceLost = false; lastMutation = null;
  globalThis.fetch = async (_url, init) => {
    const { query, params } = JSON.parse(init?.body as string) as { query: string; params: unknown[] };
    if (query.includes('COUNT(*)')) return Response.json({ fields: [{ name: 'count', dataTypeID: 23 }], rows: [['1']], rowCount: 1, command: 'SELECT' });
    if (query.trimStart().startsWith('SELECT')) return result(venueExists ? [venueRow()] : []);
    lastMutation = { query, params };
    assert.match(query, /INSERT INTO admin_audit_log/);
    if (raceLost) return result([]);
    const archivedAt = params.find((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && value !== STORED_UPDATED_AT) as string;
    return result([venueRow({ archived_at: query.includes('archived_at = $') && params.includes('venue.archive') ? archivedAt : null, updated_at: archivedAt })]);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

const context = { params: Promise.resolve({ id: 'venue-1' }) };
const adminRequest = (path: string, method: string, payload: unknown) => new Request(`http://localhost${path}`, {
  method, headers: { cookie: `${ADMIN_COOKIE_NAME}=${createAdminSession('test-admin')}` }, body: JSON.stringify(payload),
});

void test('a venue edit with field problems returns their codes', async () => {
  const response = await PATCH(adminRequest('/api/admin/venues/venue-1', 'PATCH', { ...valid, peakPricePence: 100, courtSetting: 'clay' }), context);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_venue', issues: ['priceOrder', 'courtSetting'] });
});

void test('a venue edit from a stale form is refused with the current venue', async () => {
  const response = await PATCH(adminRequest('/api/admin/venues/venue-1', 'PATCH', { ...valid, expectedUpdatedAt: '2026-10-19T09:00:00.000Z' }), context);
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error, 'venue_changed');
  assert.equal(body.venue.updatedAt, STORED_UPDATED_AT);
  assert.equal(body.venue.courtCount, 4);
  assert.equal(lastMutation, null);
});

void test('a venue edit saves court details when the form is current', async () => {
  const response = await PATCH(adminRequest('/api/admin/venues/venue-1', 'PATCH', { ...valid, courtCount: 6, courtSetting: 'indoor', floodlights: false, expectedUpdatedAt: STORED_UPDATED_AT }), context);
  assert.equal(response.status, 200);
  assert.match(lastMutation!.query, /court_count = \$\d+,\s+court_setting = \$\d+, floodlights = \$\d+/);
  const sent = lastMutation!.params.map(String);
  assert.ok(sent.includes('6') && sent.includes('indoor') && sent.includes('false'));
});

void test('a venue edit that loses a race returns the fresh venue', async () => {
  raceLost = true;
  const response = await PATCH(adminRequest('/api/admin/venues/venue-1', 'PATCH', valid), context);
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.error, 'venue_changed');
  assert.equal(body.venue.id, 'venue-1');
});

void test('archiving and restoring a venue are logged and validated', async () => {
  const archived = await ARCHIVE(adminRequest('/api/admin/venues/venue-1/archive', 'POST', { archived: true }), context);
  assert.equal(archived.status, 200);
  assert.ok((await archived.json()).venue.archivedAt);
  assert.ok(lastMutation!.params.includes('venue.archive'));
  assert.match(lastMutation!.query, /prior AS MATERIALIZED/);

  const restored = await ARCHIVE(adminRequest('/api/admin/venues/venue-1/archive', 'POST', { archived: false }), context);
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).venue.archivedAt, null);
  assert.ok(lastMutation!.params.includes('venue.restore'));

  assert.equal((await ARCHIVE(adminRequest('/api/admin/venues/venue-1/archive', 'POST', { archived: 'yes' }), context)).status, 400);
  venueExists = false;
  const missing = await ARCHIVE(adminRequest('/api/admin/venues/venue-1/archive', 'POST', { archived: true }), context);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'venue_not_found');
  const anonymous = await ARCHIVE(new Request('http://localhost/api/admin/venues/venue-1/archive', { method: 'POST', body: '{"archived":true}' }), context);
  assert.equal(anonymous.status, 401);
});

void test('undoing an older venue edit keeps court details its snapshot lacks', async () => {
  const oldFields = VENUE_FIELDS.filter((field) => !['court_count', 'court_setting', 'floodlights'].includes(field));
  const base = Object.fromEntries(oldFields.map((field) => [field, field.endsWith('pence') ? 1000 : field]));
  const auditEntry = {
    id: 'a1', created_at: '', actor: 'admin', action: 'venue.update', target_type: 'venue', target_id: 'venue-1', summary: 'x',
    before_json: JSON.stringify({ ...base, name: 'Old' }), after_json: JSON.stringify(base), undone_at: null, undone_by: null,
  };
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = ((parts: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ sql: parts.join('?').replace(/\s+/g, ' '), values });
    if (calls.length === 1) return Promise.resolve([auditEntry]);
    if (calls.length === 2) return Promise.resolve([{ ...base, court_count: 4, court_setting: 'indoor', floodlights: true }]);
    return Promise.resolve([{ id: 'log' }]);
  }) as unknown as Database;
  assert.deepEqual(await undoAdminAction(db, new Request('https://x'), 'a1'), { status: 'undone' });
  const flagFor = (column: string) => {
    const update = calls[2];
    const index = update.sql.split('?').findIndex((part) => part.endsWith(`${column} = CASE WHEN `));
    assert.ok(index >= 0, `${column} must be restored conditionally`);
    return update.values[index];
  };
  assert.equal(flagFor('court_count'), false);
  assert.equal(flagFor('court_setting'), false);
  assert.equal(flagFor('floodlights'), false);

  calls.length = 0;
  auditEntry.before_json = JSON.stringify({ ...base, name: 'Old', court_count: 2, court_setting: 'outdoor', floodlights: false });
  auditEntry.after_json = JSON.stringify({ ...base, court_count: 4, court_setting: 'indoor', floodlights: true });
  assert.deepEqual(await undoAdminAction(db, new Request('https://x'), 'a1'), { status: 'undone' });
  assert.equal(flagFor('court_count'), true);
  assert.equal(flagFor('floodlights'), true);
  assert.ok(calls[2].values.includes(2) && calls[2].values.includes('outdoor'));
});
