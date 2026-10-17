import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestExpiresOn } from '../lib/partner-request-slots';
import {
  validateReservationRequest,
  validatePartnerRequestApplication,
} from '../lib/server/reservation-request-validation';
const base = {
  requestType: 'known_venue',
  venueName: 'Victoria Park',
  contactName: 'Player',
  email: 'player@example.com',
  requestKind: 'find_partners',
  seekingPlayerCount: 1,
  venueBookingStatus: 'not_booked',
  preferredSlots: ['weekday_evening'],
};
void test('undated requests expire after 30 days; dated ones expire on their date', () => {
  assert.equal(
    requestExpiresOn(null, new Date('2026-10-17T23:00Z')),
    '2026-11-16',
  );
  assert.equal(requestExpiresOn('2026-12-01'), '2026-12-01');
  const result = validateReservationRequest(base, []);
  assert.ok(result);
  assert.equal(result.preferredDate, null);
  assert.deepEqual(result.preferredSlots, ['weekday_evening']);
  assert.equal(result.expiresOn, requestExpiresOn(null));
});
void test('booked requests need a date and clock range; other requests need valid slots', () => {
  for (const change of [
    { preferredSlots: [] },
    { preferredSlots: ['invalid'] },
    { venueBookingStatus: 'booked' },
    { preferredDate: '2099-12-01' },
    { startTime: '18:00', endTime: '20:00' },
  ])
    assert.equal(validateReservationRequest({ ...base, ...change }, []), null);
  assert.ok(
    validateReservationRequest(
      {
        ...base,
        venueBookingStatus: 'booked',
        preferredSlots: [],
        preferredDate: '2099-12-01',
        startTime: '18:00',
        endTime: '20:00',
      },
      [],
    ),
  );
});
void test('contact preferences require their matching value in both forms', () => {
  const application = {
    name: 'Player',
    email: 'player@example.com',
    tennisLevel: '3.0',
    preferredFormat: 'singles',
  };
  assert.equal(
    validateReservationRequest({ ...base, preferredContact: 'wechat' }, []),
    null,
  );
  assert.equal(
    validatePartnerRequestApplication({
      ...application,
      preferredContact: 'wechat',
    }),
    null,
  );
  assert.ok(
    validateReservationRequest(
      { ...base, preferredContact: 'wechat', wechat: 'player123' },
      [],
    ),
  );
  assert.equal(
    validatePartnerRequestApplication({ ...application, phone: 'abc' }),
    null,
  );
  assert.equal(
    validatePartnerRequestApplication({ ...application, whatsapp: '12' }),
    null,
  );
  assert.ok(
    validatePartnerRequestApplication({
      ...application,
      preferredContact: 'whatsapp',
      whatsapp: '+44 7123 456789',
    }),
  );
  assert.equal(
    validatePartnerRequestApplication({
      ...application,
      wechat: 'x'.repeat(41),
    }),
    null,
  );
});
