import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signToken, verifyToken } from '../lib/server/signed-token';

void test('signed tokens reject tampering, expiry, malformed input and purpose reuse', () => {
  const previous = process.env.REVIEW_TOKEN_SECRET;
  process.env.REVIEW_TOKEN_SECRET = 'test-secret-with-at-least-32-bytes-long';
  try {
    const now = new Date('2026-10-17T10:00:00Z');
    const token = signToken('unsubscribe', { email: 'player@example.com', v: 1 }, 60, now);
    assert.equal(verifyToken('unsubscribe', token, now)?.email, 'player@example.com');
    assert.equal(verifyToken('review', token, now), null);
    assert.equal(verifyToken('unsubscribe', token, new Date(now.getTime() + 60000)), null);
    const [body, signature] = token.split('.');
    const tampered = Buffer.from(JSON.stringify({ email: 'other@example.com', p: 'unsubscribe', exp: 9999999999 })).toString('base64url');
    assert.equal(verifyToken('unsubscribe', `${tampered}.${signature}`, now), null);
    for (const value of ['', 'bad', `${body}.bad`, `${token}.extra`]) assert.equal(verifyToken('unsubscribe', value, now), null);
    delete process.env.REVIEW_TOKEN_SECRET;
    assert.equal(verifyToken('unsubscribe', token, now), null);
    assert.throws(() => signToken('unsubscribe', {}, 60, now), /not_configured/);
  } finally {
    if (previous === undefined) delete process.env.REVIEW_TOKEN_SECRET; else process.env.REVIEW_TOKEN_SECRET = previous;
  }
});
