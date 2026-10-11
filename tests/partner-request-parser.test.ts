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
  assert.equal(drafts[1].fullDurationRequired, true);
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
