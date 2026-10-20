import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stripQuery } from '../components/site-analytics';

void test('analytics events never carry query strings or fragments', () => {
  assert.deepEqual(stripQuery({ type: 'pageview', url: 'https://x.test/?checkout=success&booking_id=TS-1#top' }), { type: 'pageview', url: 'https://x.test/' });
  assert.deepEqual(stripQuery({ type: 'pageview', url: 'https://x.test/review?t=token' }), { type: 'pageview', url: 'https://x.test/review' });
  assert.deepEqual(stripQuery({ type: 'event', url: 'https://x.test/detail/s1' }), { type: 'event', url: 'https://x.test/detail/s1' });
});
