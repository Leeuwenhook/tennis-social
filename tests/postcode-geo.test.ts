import test from 'node:test';
import assert from 'node:assert/strict';
import { findPostcode, milesBetween, normalizePostcode } from '../lib/postcode-geo';
import { hasPartnerWaiting } from '../lib/tennis-utils';

void test('postcodes normalise to full codes or outcodes', () => {
  assert.equal(normalizePostcode(' se1  7pb '), 'SE1 7PB');
  assert.equal(normalizePostcode('se17pb'), 'SE1 7PB');
  assert.equal(normalizePostcode('SE16'), 'SE16');
  assert.equal(normalizePostcode('London'), '');
});

void test('venue postcodes fall back to addresses and outcodes', () => {
  assert.equal(findPostcode('', 'Albany Rd, London SE5 0AL', 'South'), 'SE5 0AL');
  assert.equal(findPostcode('', '', 'School House, Sophia Rd, London E16 3PB'), 'E16 3PB');
  assert.equal(findPostcode('SE1', 'Carlisle Ln'), 'SE1');
  assert.equal(findPostcode('', '', 'London'), '');
});

void test('distance between central London points is in miles', () => {
  const miles = milesBetween({ lat: 51.501972, lng: -0.119003 }, { lat: 51.4994, lng: -0.0914 });
  assert.ok(miles > 1 && miles < 1.4, String(miles));
});

void test('partner waiting needs a booking and an open place', () => {
  assert.equal(hasPartnerWaiting({ capacity: 4, bookedSpots: 1, markedFull: false }), true);
  assert.equal(hasPartnerWaiting({ capacity: 4, bookedSpots: 0, markedFull: false }), false);
  assert.equal(hasPartnerWaiting({ capacity: 2, bookedSpots: 2, markedFull: false }), false);
  assert.equal(hasPartnerWaiting({ capacity: 4, bookedSpots: 1, markedFull: true }), false);
});
