import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sessionInputIssues,
  validateSessionInput,
} from '../lib/server/admin-validation';
import { venues } from '../lib/demo-data';
const input = {
  venueId: venues[0].id,
  date: '2026-11-01',
  startTime: '12:00',
  endTime: '13:00',
  pricePence: 0,
  capacity: 0,
  status: 'published',
};
void test('zero capacity and empty descriptions are valid; capacity stays bounded', () => {
  assert.ok(validateSessionInput(input));
  for (const capacity of [-1, 1001])
    assert.ok(sessionInputIssues({ ...input, capacity }).includes('capacity'));
});
