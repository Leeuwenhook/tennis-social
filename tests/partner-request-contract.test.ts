import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serializePublicReservationRequest, serializeReservationRequest } from '../lib/server/database';
import { validatePartnerRequestApplication, validateReservationRequest } from '../lib/server/reservation-request-validation';

const base = { requestType: 'known_venue', venueName: 'Victoria Park', preferredSlots: ['evening'], preferredDate: '2099-12-20', startTime: '18:00', endTime: '20:00', contactName: 'Player', email: 'player@example.com' };

void test('structured reservation request fields validate and normalize', () => {
  const result = validateReservationRequest({ ...base, requestKind: 'find_partners', venueBookingStatus: 'booked', existingPlayerLevels: ['2.5'], seekingPlayerCount: 2, seekingLevels: ['3.0'], preferredFormat: 'doubles', budgetPence: 1200 }, []);
  assert.equal(result?.requestKind, 'find_partners');
  assert.deepEqual(result?.seekingLevels, ['3.0']);
  assert.equal(result?.budgetPence, 1200);
  assert.equal(validateReservationRequest({ ...base, requestKind: 'find_partners', seekingPlayerCount: -1 }, []), null);
});

void test('public serialization excludes contact details and message', () => {
  const row = { id: 'r1', request_type: 'known_venue' as const, venue_id: null, venue_name: 'Victoria Park', postcode: '', preferred_date: '2099-12-20', start_time: '18:00', end_time: '20:00', contact_name: 'Private', email: 'private@example.com', phone: '123', wechat: 'private-id', whatsapp: '+447123456789', preferred_contact: 'wechat' as const, message: 'private', status: 'pending' as const, created_at: '', updated_at: '', area: 'East' };
  const result = serializePublicReservationRequest(row);
  assert.equal(result.id, 'r1');
  for (const key of ['email', 'phone', 'wechat', 'whatsapp', 'preferredContact', 'contactName', 'message']) assert.equal(key in result, false);
  assert.equal('message' in result, false);
  assert.equal(serializeReservationRequest(row).email, 'private@example.com');
});

void test('applications require a known level and format', () => {
  assert.ok(validatePartnerRequestApplication({ name: 'A', email: 'a@example.com', tennisLevel: '3.0', preferredFormat: 'doubles' }));
  assert.equal(validatePartnerRequestApplication({ name: 'A', email: 'a@example.com', tennisLevel: 'pro', preferredFormat: 'doubles' }), null);
});

void test('structured fields are validated even without a request kind', () => {
  assert.ok(validateReservationRequest(base, []));
  assert.equal(validateReservationRequest({ ...base, venueBookingStatus: 'hacked' }, []), null);
  assert.equal(validateReservationRequest({ ...base, budgetPence: 'abc' }, []), null);
});

void test('partner searches need players and court-only requests need none', () => {
  assert.equal(validateReservationRequest({ ...base, requestKind: 'find_partners', seekingPlayerCount: 0 }, []), null);
  assert.equal(validateReservationRequest({ ...base, requestKind: 'find_both', seekingPlayerCount: 0 }, []), null);
  assert.ok(validateReservationRequest({ ...base, requestKind: 'find_both', seekingPlayerCount: 1 }, []));
  assert.equal(validateReservationRequest({ ...base, requestKind: 'find_court', seekingPlayerCount: 1 }, []), null);
  assert.equal(validateReservationRequest({ ...base, requestType: 'find_nearby', venueName: '', postcode: 'E3 5TB', requestKind: 'find_court', seekingPlayerCount: 2 }, []), null);
});

void test('serializers derive booked periods, preserve unbooked choices and use date as expiry', () => {
  const row = { id: 'r1', request_type: 'known_venue' as const, venue_id: null, venue_name: 'Victoria Park', postcode: '', preferred_date: '2099-12-20', start_time: '11:00', end_time: '18:30', contact_name: 'Private', email: 'private@example.com', phone: '', message: '', status: 'pending' as const, created_at: '', updated_at: '', preferred_slots_json: '["evening"]', expires_on: '2099-12-30' };
  for (const serialize of [serializePublicReservationRequest, serializeReservationRequest]) {
    assert.deepEqual(serialize({ ...row, venue_booking_status: 'booked' }).preferredSlots, ['morning', 'afternoon', 'evening']);
    assert.deepEqual(serialize({ ...row, venue_booking_status: 'not_booked' }).preferredSlots, ['evening']);
    assert.deepEqual(serialize({ ...row, preferred_slots_json: '[]' }).preferredSlots, ['morning', 'afternoon', 'evening']);
    assert.equal(serialize(row).expiresOn, row.preferred_date);
  }
});
