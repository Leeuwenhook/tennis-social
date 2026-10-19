import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, sessionDurationBadge } from '../lib/formatters';
void test('duration badges start above an hour and format irregular durations', () => {
  assert.equal(sessionDurationBadge('12:00', '13:00', 'en'), null);
  assert.equal(sessionDurationBadge('12:00', '13:30', 'en'), '1.5h session');
  assert.equal(sessionDurationBadge('12:00', '13:30', 'zh'), '1.5小时场');
  assert.equal(sessionDurationBadge('12:00', '14:00', 'en'), '2h session');
  assert.equal(sessionDurationBadge('12:00', '13:05', 'en'), '1h 5m session');
});

void test('money keeps pence for discounted prices and stays short for whole pounds', () => {
  assert.equal(formatMoney(630, 'en'), '£6.30');
  assert.equal(formatMoney(600, 'en'), '£6');
  assert.equal(formatMoney(1205, 'zh'), '£12.05');
});
