import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET, POST } from '../app/api/email/unsubscribe/route';
import { signToken } from '../lib/server/signed-token';
void test('unsubscribe verifies the signature before accessing the database and normalizes suppression emails', async (t) => {
  const keys = ['REVIEW_TOKEN_SECRET', 'DATABASE_URL', 'POSTGRES_URL'] as const;
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  process.env.REVIEW_TOKEN_SECRET = 'test-secret-with-at-least-32-bytes-long';
  process.env.DATABASE_URL =
    'postgresql://test:test@unsubscribe-tests.neon.tech/testdb';
  let calls = 0;
  const mocked = t.mock.method(
    globalThis,
    'fetch',
    (_url: unknown, init?: RequestInit) => {
      calls++;
      assert.equal(typeof init?.body, 'string');
      const query = JSON.parse(init!.body as string) as {
        query: string;
        params: string[];
      };
      assert.match(query.query, /INSERT INTO email_suppressions/);
      assert.match(query.query, /ON CONFLICT \(email\) DO NOTHING/);
      assert.equal(query.params[0], 'player@example.com');
      return Promise.resolve(
        Response.json({ fields: [], rows: [], rowCount: 0, command: 'INSERT' }),
      );
    },
  );
  try {
    for (const handler of [GET, POST])
      assert.equal(
        (
          await handler(
            new Request('https://example.com/api/email/unsubscribe?t=bad', {
              method: handler === POST ? 'POST' : 'GET',
            }),
          )
        ).status,
        400,
      );
    assert.equal(calls, 0);
    const token = signToken(
      'unsubscribe',
      { email: ' Player@Example.com ', v: 1 },
      3600,
    );
    const url = `https://example.com/api/email/unsubscribe?t=${token}`;
    // Link scanners prefetch GET URLs: the page only offers a confirmation form.
    const page = GET(new Request(url));
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<form method="post"/);
    assert.equal(calls, 0);
    for (let i = 0; i < 2; i++) {
      const response = await POST(
        new Request(url, {
          method: 'POST',
          body: 'List-Unsubscribe=One-Click',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        }),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(calls, 2);
  } finally {
    mocked.mock.restore();
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
