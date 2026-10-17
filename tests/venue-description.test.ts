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
import { sendConfirmedBookingEmail } from '../lib/server/booking-email';
import type { BookingEmailInput } from '../lib/server/email';
import type { Database } from '../lib/server/database';

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

void test('booking confirmation loads the stored venue description', async () => {
  const env = { SMTP_USER: 'test', SMTP_PASSWORD: 'test', EMAIL_FROM: 'test@example.com' };
  const original = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  const venueRow: Record<string, unknown> = {
    id: venues[0].id, name: venues[0].name, name_zh: venues[0].nameZh, area: venues[0].area,
    area_zh: venues[0].areaZh, address: '', address_zh: '', postcode: '', photo: venues[0].photo,
    description: 'Custom venue copy', description_zh: '自定义场地介绍',
    peak_price_pence: 1000, off_peak_price_pence: 800, created_at: '', updated_at: '',
  };
  const booking = {
    id: 'b1', status: 'confirmed', confirmation_email_status: 'pending',
    venue_id: venues[0].id, date: '2026-12-01', start_time: '18:00', end_time: '20:00',
  };
  const db = (async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('FROM venues')) {
      // Emulate column projection: only selected columns come back.
      const selected = sql.slice(sql.indexOf('SELECT') + 6, sql.indexOf('FROM venues'));
      return [Object.fromEntries(Object.entries(venueRow).filter(([key]) => new RegExp(`\\b${key}\\b`).test(selected)))];
    }
    if (sql.includes('UPDATE bookings') || sql.includes('FROM bookings')) return [booking];
    return [];
  }) as unknown as Database;
  let sentVenue: BookingEmailInput['venue'] | undefined;
  try {
    await sendConfirmedBookingEmail(db, 'b1', async (input) => {
      sentVenue = input.venue;
      return { messageId: 'm1' } as Awaited<ReturnType<NonNullable<Parameters<typeof sendConfirmedBookingEmail>[2]>>>;
    });
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  assert.deepEqual(resolveVenueDescriptions(sentVenue!), {
    description: 'Custom venue copy',
    descriptionZh: '自定义场地介绍',
  });
});
