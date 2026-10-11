import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serializePublicReservationRequest, serializeReservationRequest } from '../lib/server/database';
import { validatePartnerRequestApplication, validateReservationRequest } from '../lib/server/reservation-request-validation';

const base = { requestType: 'known_venue', venueName: 'Victoria Park', preferredDate: '2099-12-20', startTime: '18:00', endTime: '20:00', contactName: 'Player', email: 'player@example.com' };

void test('structured reservation request fields validate and normalize', () => {
  const result = validateReservationRequest({ ...base, requestKind: 'find_partners', venueBookingStatus: 'booked', existingPlayerLevels: ['2.5'], seekingPlayerCount: 2, seekingLevels: ['3.0'], preferredFormat: 'doubles', fullDurationRequired: true, budgetPence: 1200 }, []);
  assert.equal(result?.requestKind, 'find_partners');
  assert.deepEqual(result?.seekingLevels, ['3.0']);
  assert.equal(result?.budgetPence, 1200);
  assert.equal(validateReservationRequest({ ...base, requestKind: 'find_partners', seekingPlayerCount: -1 }, []), null);
});

void test('public serialization excludes contact details and message', () => {
  const row = { id: 'r1', request_type: 'known_venue' as const, venue_id: null, venue_name: 'Victoria Park', postcode: '', preferred_date: '2099-12-20', start_time: '18:00', end_time: '20:00', contact_name: 'Private', email: 'private@example.com', phone: '123', message: 'private', status: 'pending' as const, created_at: '', updated_at: '', area: 'East' };
  const result = serializePublicReservationRequest(row);
  assert.equal(result.id, 'r1');
  assert.equal('email' in result, false);
  assert.equal('message' in result, false);
  assert.equal(serializeReservationRequest(row).email, 'private@example.com');
});

void test('applications require a known level, format, and attendance flag', () => {
  assert.ok(validatePartnerRequestApplication({ name: 'A', email: 'a@example.com', tennisLevel: '3.0', preferredFormat: 'doubles', canAttendFullDuration: true }));
  assert.equal(validatePartnerRequestApplication({ name: 'A', email: 'a@example.com', tennisLevel: 'pro', preferredFormat: 'doubles', canAttendFullDuration: true }), null);
});
