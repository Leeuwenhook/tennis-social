import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateSessionDescriptions,
  resolveSessionDescriptions,
} from '../lib/server/session-description';

const previous = {
  venueName: 'Tanner St Park',
  venueNameZh: 'Tanner St 公园',
  date: '2026-10-20',
  startTime: '18:00',
  endTime: '20:00',
  formats: ['doubles'] as const,
  capacity: 8,
};

void test('empty descriptions are generated for the session being saved', () => {
  const result = resolveSessionDescriptions({ ...previous, description: '', descriptionZh: '' });
  assert.deepEqual(result, generateSessionDescriptions(previous));
});

void test('untouched auto text follows date and capacity edits, custom text is kept', () => {
  const auto = generateSessionDescriptions(previous);
  const edited = { ...previous, date: '2026-10-27', capacity: 3 };
  const refreshed = resolveSessionDescriptions({ ...edited, ...auto }, previous);
  assert.deepEqual(refreshed, generateSessionDescriptions(edited));
  assert.match(refreshed.description, /2026-10-27/);
  assert.doesNotMatch(refreshed.descriptionZh, /2026-10-20/);

  const custom = resolveSessionDescriptions(
    { ...edited, description: 'Bring water.', descriptionZh: auto.descriptionZh },
    previous,
  );
  assert.equal(custom.description, 'Bring water.');
  assert.equal(custom.descriptionZh, generateSessionDescriptions(edited).descriptionZh);
});
