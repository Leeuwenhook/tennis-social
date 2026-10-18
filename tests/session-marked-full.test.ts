import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeSession, type SessionRow } from '../lib/server/database';
import { availableSpots, displayedBookedSpots, sessionPayload } from '../lib/tennis-utils';

const row: SessionRow = {
  id: 'session-1',
  venue_id: 'venue-1',
  date: '2026-11-01',
  start_time: '16:00',
  end_time: '17:00',
  price_pence: 800,
  capacity: 4,
  booked_spots: 1,
  formats_json: '["doubles"]',
  seeking_levels_json: '[]',
  status: 'published',
  description: '',
  description_zh: '',
};

void test('marking full keeps capacity and closes every remaining place', () => {
  const open = serializeSession(row);
  assert.equal(open.markedFull, false);
  assert.equal(availableSpots(open), 3);
  assert.equal(displayedBookedSpots(open), 1);

  const full = serializeSession({ ...row, marked_full: true });
  assert.equal(full.capacity, 4);
  assert.equal(full.bookedSpots, 1);
  assert.equal(availableSpots(full), 0);
  assert.equal(displayedBookedSpots(full), 4);
});

void test('session payload carries the flag so edits and undo preserve it', () => {
  assert.equal(sessionPayload(serializeSession({ ...row, marked_full: true })).markedFull, true);
  assert.equal(sessionPayload(serializeSession(row)).markedFull, false);
});
