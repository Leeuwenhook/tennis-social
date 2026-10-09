import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateReservationRequest } from '../lib/server/reservation-request-validation';

const request = {
  requestType: 'known_venue',
  venueName: 'Victoria Park',
  preferredDate: '2099-12-20',
  startTime: '18:00',
  endTime: '20:00',
  contactName: 'Test Player',
  email: 'test@example.com',
  message: 'Two players',
};

void test('partner matching requirements survive in the saved request notes', () => {
  const result = validateReservationRequest(
    {
      ...request,
      needsPartner: true,
      tennisLevel: '3.0',
      gameFormat: 'doubles',
    },
    [],
  );
  assert.ok(result);
  assert.equal(
    result.message,
    'Partner matching: Yes; Tennis level: 3.0; Format: Doubles.\nTwo players',
  );
});

void test('declining partner matching is saved without requiring level or format', () => {
  const result = validateReservationRequest(
    { ...request, needsPartner: false },
    [],
  );
  assert.ok(result);
  assert.equal(result.message, 'Partner matching: No.\nTwo players');
});

void test('incomplete or invalid partner matching cannot be submitted', () => {
  for (const details of [
    { needsPartner: null },
    { needsPartner: 'yes' },
    { needsPartner: true },
    { needsPartner: true, tennisLevel: '3.0', gameFormat: 'both' },
    { needsPartner: true, tennisLevel: 'expert', gameFormat: 'singles' },
  ])
    assert.equal(
      validateReservationRequest({ ...request, ...details }, []),
      null,
    );
});

void test('partner details are retained when other notes reach the length limit', () => {
  const result = validateReservationRequest(
    {
      ...request,
      message: 'x'.repeat(1000),
      needsPartner: true,
      tennisLevel: '4.0',
      gameFormat: 'singles',
    },
    [],
  );
  assert.ok(result);
  assert.equal(result.message.length, 1000);
  assert.ok(
    result.message.startsWith(
      'Partner matching: Yes; Tennis level: 4.0; Format: Singles.',
    ),
  );
});

void test('existing court request forms remain compatible', () => {
  assert.equal(validateReservationRequest(request, [])?.message, 'Two players');
});
