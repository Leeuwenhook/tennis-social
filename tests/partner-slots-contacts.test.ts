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
  preferredSlots: ['evening'],
  preferredDate: '2099-12-01',
};
void test('all requests require a date and expire on that date', () => {
  assert.equal(requestExpiresOn('2026-12-01'), '2026-12-01');
  const result = validateReservationRequest(base, []);
  assert.ok(result);
  assert.equal(result.preferredDate, base.preferredDate);
  assert.equal(result.startTime, null);
  assert.deepEqual(result.preferredSlots, ['evening']);
  assert.equal(result.expiresOn, base.preferredDate);
  for (const preferredDate of [undefined, null, '', '2099-02-30', '2020-01-01']) {
    assert.equal(validateReservationRequest({ ...base, preferredDate }, []), null);
  }
});
void test('booked requests need a date and clock range; other requests need valid slots', () => {
  for (const change of [
    { preferredSlots: [] },
    { preferredSlots: ['invalid'] },
    { venueBookingStatus: 'booked' },
    { preferredDate: '' },
    { startTime: '18:00' },
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

void test('period boundaries use all overlapping periods and exclude the end instant', async () => {
  const { slotsForTimeRange, slotForSchedule, slotsFromText } = await import('../lib/partner-request-slots');
  for (const [start, end, expected] of [
    ['00:00', '12:00', ['morning']],
    ['12:00', '18:00', ['afternoon']],
    ['17:59', '18:01', ['afternoon', 'evening']],
    ['18:00', '24:00', ['evening']],
    ['11:30', '18:30', ['morning', 'afternoon', 'evening']],
    ['25:00', '26:00', []],
    ['18:00', '17:00', []],
    ['18:00', '18:00', []],
  ] as const) assert.deepEqual(slotsForTimeRange(start, end), expected);
  assert.equal(slotForSchedule('2026-10-18', '17:59'), 'afternoon');
  assert.equal(slotForSchedule('2026-10-19', '18:00'), 'evening');
  assert.deepEqual(slotsFromText('早上 morning 下午 afternoon 晚上 evening night'), ['morning', 'afternoon', 'evening']);
  assert.deepEqual(slotsFromText('weekend 周末'), []);
  assert.equal(validateReservationRequest({ ...base, preferredSlots: ['weekday_evening'] }, []), null);
  assert.equal(validateReservationRequest({ ...base, preferredSlots: ['weekend_any'] }, []), null);
  const booked = validateReservationRequest({ ...base, venueBookingStatus: 'booked', startTime: '11:00', endTime: '18:30', preferredSlots: ['evening'] }, []);
  assert.deepEqual(booked?.preferredSlots, ['morning', 'afternoon', 'evening']);
});
