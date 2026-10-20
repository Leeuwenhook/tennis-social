import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditedMutation, listAuditLog } from '../lib/server/audit-log';
import type { Database } from '../lib/server/database';

void test('audit SQL locks the before image, logs only changed rows and binds every value without gaps', async () => {
  for (const targetType of ['session', 'venue', 'request', 'application', 'review', 'settings'] as const) {
    let called = false;
    const db = { query: async (query: string, values: unknown[]) => {
      called = true;
      assert.match(query, /prior AS MATERIALIZED.*FOR UPDATE/);
      assert.match(query, /INSERT INTO admin_audit_log/);
      assert.match(query, /FROM changed RETURNING id/);
      assert.equal(query.includes('dangerous-value'), false);
      assert.ok(values.includes('dangerous-value'));
      const slots = new Set([...query.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])));
      assert.deepEqual([...slots].sort((a, b) => a - b), values.map((_, index) => index + 1));
      return [];
    } } as unknown as Database;
    const write = auditedMutation(db, new Request('https://admin.test'), { action: `${targetType}.update`, targetType, targetId: 'id', summary: 'changed' });
    if (targetType === 'settings') await write`INSERT INTO app_settings (key, value) VALUES (${'id'}, ${'dangerous-value'}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value RETURNING value`;
    else await write`UPDATE sessions SET status = ${'dangerous-value'} WHERE id = ${'id'} RETURNING *`;
    assert.equal(called, true);
  }
});

void test('activity includes login outcomes without disclosing IP hashes and filters the combined result', async () => {
  const db = ((parts: TemplateStringsArray) => {
    const query = parts.join('?');
    assert.match(query, /UNION ALL/);
    assert.match(query, /FROM admin_login_attempts/);
    assert.match(query, /AS activity/);
    assert.equal(query.includes('ip_hash'), false);
    return Promise.resolve([]);
  }) as unknown as Database;
  assert.deepEqual(await listAuditLog(db, new URLSearchParams('targetType=auth')), { entries: [], nextOffset: null, nextCursor: null });
});
