import assert from 'node:assert/strict';
import { test } from 'node:test';
import { venues } from '../lib/demo-data';
import {
  generateVenueDescriptions,
  resolveVenueDescriptions,
} from '../lib/venue-description';
import {
  validateVenueInput,
  validateSessionInput,
} from '../lib/server/admin-validation';
import {
  serializeVenue,
  serializeSession,
  type VenueRow,
  type SessionRow,
} from '../lib/server/database';
import { sessionPayload } from '../lib/tennis-utils';

void test('venue fallback uses public location in both languages without session facts or internal notes', () => {
  const venue = { ...venues[0], notes: 'PRIVATE ADMIN NOTE' };
  const generated = generateVenueDescriptions(venue);
  assert.ok(generated.description.includes(venue.name));
  assert.ok(generated.description.includes(venue.address!));
  assert.ok(generated.descriptionZh.includes(venue.nameZh));
  assert.ok(generated.descriptionZh.includes(venue.addressZh!));
  assert.doesNotMatch(
    JSON.stringify(generated),
    /PRIVATE|players|\d{2}:\d{2}|\d{4}-\d{2}-\d{2}/,
  );
  assert.deepEqual(
    resolveVenueDescriptions({
      ...venue,
      description: null,
      descriptionZh: '  ',
    }),
    generated,
  );
  assert.equal(
    resolveVenueDescriptions({ ...venue, description: '  Custom text  ' })
      .description,
    'Custom text',
  );
  assert.equal(
    resolveVenueDescriptions({ ...venue, description: 'Custom' }).descriptionZh,
    generated.descriptionZh,
  );
});

void test('venue validation and serialization preserve optional bilingual public copy separately from notes', () => {
  const input = {
    ...venues[0],
    description: ' Custom English ',
    descriptionZh: ' 中文介绍 ',
  };
  const validated = validateVenueInput(input)!;
  assert.equal(validated.description, 'Custom English');
  assert.equal(validated.descriptionZh, '中文介绍');
  assert.equal(
    validateVenueInput({ ...input, description: ' ' })!.description,
    null,
  );
  assert.equal(
    validateVenueInput({ ...input, descriptionZh: null })!.descriptionZh,
    null,
  );
  assert.equal(
    validateVenueInput({ ...input, description: 'x'.repeat(2100) })!
      .description!.length,
    2000,
  );
  const serialized = serializeVenue({
    id: input.id,
    description: 'English',
    description_zh: '中文',
    notes: 'internal',
  } as VenueRow);
  assert.equal(serialized.description, 'English');
  assert.equal(serialized.descriptionZh, '中文');
});

void test('legacy session description input is ignored and absent from serialized sessions and copies', () => {
  const session = validateSessionInput({
    venueId: venues[0].id,
    date: '2026-12-01',
    startTime: '18:00',
    endTime: '20:00',
    capacity: 4,
    pricePence: 1000,
    status: 'published',
    description: 'ignored',
    descriptionZh: '忽略',
  } as Parameters<typeof validateSessionInput>[0])!;
  assert.ok(session);
  assert.ok(!('description' in session));
  const serialized = serializeSession({
    description: 'legacy',
    description_zh: '旧文案',
    formats_json: '[]',
  } as unknown as SessionRow);
  assert.ok(!('description' in serialized));
  assert.ok(!('descriptionZh' in sessionPayload(serialized)));
});
