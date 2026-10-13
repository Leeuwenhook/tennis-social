import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePartnerRequestDraft, parsePartnerRequestDrafts } from '../lib/partner-request-parser';

void test('parses venue-only first lines with Chinese area suffixes and keeps missing fields', () => {
  const draft = parsePartnerRequestDraft('Ravenscourt Park（西伦敦） / 4–5PM / 球友水平2.5');
  assert.equal(draft.venueName, 'Ravenscourt Park');
  assert.equal(draft.startTime, '16:00');
  assert.equal(draft.endTime, '17:00');
  assert.deepEqual(draft.existingPlayerLevels, ['2.5']);
  assert.equal(draft.requestKind, 'find_partners');
  assert.deepEqual(draft.missing, ['preferredDate', 'seekingPlayerCount']);
});

void test('splits blank-line blocks and parses continuous duration', () => {
  const drafts = parsePartnerRequestDrafts(
    'Ravenscourt Park（西伦敦） / 4–5PM / 球友水平2.5\n\nChestnuts Park（北伦敦） / 6–8PM（连续2小时） / 球友水平3.0',
  );
  assert.equal(drafts.length, 2);
  assert.equal(drafts[1].venueName, 'Chestnuts Park');
  assert.equal(drafts[1].startTime, '18:00');
  assert.equal(drafts[1].endTime, '20:00');
});

void test('recognises looking-for-partner wording while retaining explicit booking status', () => {
  const draft = parsePartnerRequestDraft('Venue: Victoria Park, existing player 2.5, looking for a partner, not booked');
  assert.equal(draft.requestKind, 'find_partners');
  assert.equal(draft.venueBookingStatus, 'not_booked');
  assert.equal(parsePartnerRequestDraft('Chestnuts Park\n6–8PM\n未预订').venueBookingStatus, 'not_booked');
  assert.equal(parsePartnerRequestDraft('Chestnuts Park\n6–8PM\nunbooked').requestKind, 'find_both');
});

void test('keeps the single-draft API and explicit booked signals', () => {
  const draft = parsePartnerRequestDraft('at Victoria Park on 2099-12-20 from 6–8pm, booked, need 2 players, doubles');
  assert.equal(draft.venueName, 'Victoria Park');
  assert.equal(draft.preferredDate, '2099-12-20');
  assert.equal(draft.startTime, '18:00');
  assert.equal(draft.endTime, '20:00');
  assert.equal(draft.venueBookingStatus, 'booked');
  assert.equal(draft.requestKind, 'find_partners');
  assert.equal(draft.seekingPlayerCount, 2);
  assert.equal(draft.preferredFormat, 'doubles');
  assert.deepEqual(draft.missing, []);
});

void test('ignores empty blocks and handles CRLF and multiline venue names', () => {
  const drafts = parsePartnerRequestDrafts('\r\nChestnuts Park（北伦敦）\r\n6–8PM（连续2小时）\r\n球友水平3.0\r\n \r\n');
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].venueName, 'Chestnuts Park');
  assert.equal(parsePartnerRequestDraft('Looking for a partner').requestKind, undefined);
  assert.deepEqual(parsePartnerRequestDrafts('   '), []);
});

void test('venue extraction respects word boundaries and prefers the first-line venue', () => {
  assert.equal(parsePartnerRequestDraft('Ravenscourt Park, 4-5pm, need 1').venueName, 'Ravenscourt Park');
  assert.equal(parsePartnerRequestDraft('Chestnuts Park Saturday 6-8pm').venueName, 'Chestnuts Park');
  const notBooked = parsePartnerRequestDraft('Victoria Park, court not yet booked');
  assert.equal(notBooked.venueName, 'Victoria Park');
  assert.equal(notBooked.venueBookingStatus, 'not_booked');
  assert.equal(parsePartnerRequestDraft('场地：维多利亚公园 6-8pm').venueName, '维多利亚公园');
});

void test('level ranges are not parsed as times', () => {
  const draft = parsePartnerRequestDraft('Victoria Park 水平3.0-3.5 6-8pm');
  assert.equal(draft.startTime, '18:00');
  assert.equal(draft.endTime, '20:00');
  assert.deepEqual(draft.existingPlayerLevels, ['3.0']);
  const noTime = parsePartnerRequestDraft('Victoria Park 水平3.0-3.5');
  assert.equal(noTime.startTime, undefined);
  assert.ok(noTime.missing.includes('time'));
});

void test('rejects invalid dates and resolves meridiems and durations sensibly', () => {
  const invalid = parsePartnerRequestDraft('Victoria Park 2026-13-45 6-8pm');
  assert.equal(invalid.preferredDate, undefined);
  assert.ok(invalid.missing.includes('preferredDate'));
  assert.equal(parsePartnerRequestDraft('Victoria Park 31/02/2026').preferredDate, undefined);
  assert.equal(parsePartnerRequestDraft('Victoria Park 29/02/2028').preferredDate, '2028-02-29');
  const midday = parsePartnerRequestDraft('Victoria Park 11-1pm');
  assert.equal(midday.startTime, '11:00');
  assert.equal(midday.endTime, '13:00');
  const morning = parsePartnerRequestDraft('Victoria Park 11am-1');
  assert.equal(morning.startTime, '11:00');
  assert.equal(morning.endTime, '13:00');
  const continuous = parsePartnerRequestDraft('Chestnuts Park 6-8pm 连续2.5小时 球友水平3.0');
  assert.deepEqual(continuous.existingPlayerLevels, ['3.0']);
  const late = parsePartnerRequestDraft('Victoria Park 22:00 for 2 hours');
  assert.equal(late.startTime, '22:00');
  assert.equal(late.endTime, '24:00');
  const evening = parsePartnerRequestDraft('Victoria Park 6pm for 1.5 hours');
  assert.equal(evening.startTime, '18:00');
  assert.equal(evening.endTime, '19:30');
  assert.ok(parsePartnerRequestDraft('Victoria Park 23:00 for 2 hours').missing.includes('time'));
});

void test('splits list items and consecutive one-line venue requests conservatively', () => {
  const listed = parsePartnerRequestDrafts('- Ravenscourt Park 4-5pm need 1\n- Chestnuts Park 6-8pm need 2');
  assert.deepEqual(listed.map((draft) => draft.venueName), ['Ravenscourt Park', 'Chestnuts Park']);
  assert.equal(listed[1].seekingPlayerCount, 2);
  const numbered = parsePartnerRequestDrafts('1. Victoria Park\n2. Highbury Fields');
  assert.deepEqual(numbered.map((draft) => draft.venueName), ['Victoria Park', 'Highbury Fields']);
  const oneLiners = parsePartnerRequestDrafts('Ravenscourt Park / 4–5PM\nChestnuts Park / 6–8PM');
  assert.equal(oneLiners.length, 2);
  const detailList = parsePartnerRequestDrafts('Victoria Park\n- 6-8pm\n- need 2 players');
  assert.equal(detailList.length, 1);
  assert.equal(detailList[0].venueName, 'Victoria Park');
  assert.equal(detailList[0].seekingPlayerCount, 2);
  assert.equal(parsePartnerRequestDrafts('Chestnuts Park（北伦敦）\n6–8PM（连续2小时）\n球友水平3.0').length, 1);
});
