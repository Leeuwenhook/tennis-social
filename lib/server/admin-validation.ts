import { GAME_FORMATS, venues, type GameFormat } from '../demo-data';

export type VenueInput = {
  name?: unknown;
  nameZh?: unknown;
  area?: unknown;
  areaZh?: unknown;
  notes?: unknown;
  photo?: unknown;
  peakPricePence?: unknown;
  offPeakPricePence?: unknown;
};

export type ValidatedVenueInput = {
  name: string;
  nameZh: string;
  area: string;
  areaZh: string;
  notes: string;
  photo: string;
  peakPricePence: number;
  offPeakPricePence: number;
};

export type SessionInput = {
  venueId?: unknown;
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  pricePence?: unknown;
  capacity?: unknown;
  formats?: unknown;
  description?: unknown;
  descriptionZh?: unknown;
  status?: unknown;
};

export type SessionValidationIssue =
  | 'row'
  | 'venue'
  | 'date'
  | 'start_time'
  | 'end_time'
  | 'time_order'
  | 'price'
  | 'capacity'
  | 'formats'
  | 'description'
  | 'description_zh'
  | 'status';

export type ValidatedSessionInput = {
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  pricePence: number;
  capacity: number;
  formats: GameFormat[];
  description: string;
  descriptionZh: string;
  status: 'published' | 'draft';
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function minutes(value: string) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

export function validateVenueInput(input: VenueInput): ValidatedVenueInput | null {
  const name = cleanString(input.name, 120);
  const nameZh = cleanString(input.nameZh, 120);
  const area = cleanString(input.area, 120);
  const areaZh = cleanString(input.areaZh, 120);
  const notes = cleanString(input.notes, 500);
  const rawPhoto = typeof input.photo === 'string' ? input.photo.trim() : '';
  const photo = rawPhoto.slice(0, 2_500_000);
  const peakPriceValue = typeof input.peakPricePence === 'string'
    ? input.peakPricePence.trim()
    : typeof input.peakPricePence === 'number' ? String(input.peakPricePence) : '';
  const offPeakPriceValue = typeof input.offPeakPricePence === 'string'
    ? input.offPeakPricePence.trim()
    : typeof input.offPeakPricePence === 'number' ? String(input.offPeakPricePence) : '';
  const peakPricePence = Number(peakPriceValue);
  const offPeakPricePence = Number(offPeakPriceValue);
  const isSafePhoto = photo.startsWith('/') || /^https?:\/\//i.test(photo) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(photo);
  if (
    !name || !nameZh || !area || !areaZh || !rawPhoto || rawPhoto.length > 2_500_000 || !isSafePhoto || !peakPriceValue || !offPeakPriceValue ||
    !Number.isInteger(peakPricePence) || peakPricePence < 0 || peakPricePence > 100_000 ||
    !Number.isInteger(offPeakPricePence) || offPeakPricePence < 0 || offPeakPricePence > 100_000 ||
    peakPricePence < offPeakPricePence
  ) return null;
  return { name, nameZh, area, areaZh, notes, photo, peakPricePence, offPeakPricePence };
}

export function getSessionInputIssues(
  input: SessionInput,
  validVenueIds: Iterable<string> = venues.map((venue) => venue.id),
): SessionValidationIssue[] {
  const venueId = cleanString(input.venueId, 80);
  const date = cleanString(input.date, 10);
  const startTime = cleanString(input.startTime, 5);
  const endTime = cleanString(input.endTime, 5);
  const description = cleanString(input.description, 2000);
  const descriptionZh = cleanString(input.descriptionZh, 2000);
  const pricePence = Number(input.pricePence);
  const capacity = Number(input.capacity);
  const formatsInput = input.formats;
  const formatsValid = formatsInput === undefined || (
    Array.isArray(formatsInput) && formatsInput.every((format) => GAME_FORMATS.includes(format as GameFormat))
  );
  const formats = formatsInput === undefined
    ? [...GAME_FORMATS]
    : Array.isArray(formatsInput)
      ? [...new Set(formatsInput as GameFormat[])]
      : [];
  const status = input.status === 'draft' ? 'draft' : input.status === 'published' ? 'published' : '';
  const issues: SessionValidationIssue[] = [];
  if (!new Set(validVenueIds).has(venueId)) issues.push('venue');
  if (!isDate(date)) issues.push('date');
  const startValid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) && minutes(startTime) >= 0 && minutes(startTime) <= 1439;
  const endValid = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(endTime) && minutes(endTime) >= 1 && minutes(endTime) <= 1440;
  if (!startValid) issues.push('start_time');
  if (!endValid) issues.push('end_time');
  if (startValid && endValid && minutes(endTime) <= minutes(startTime)) issues.push('time_order');
  if (!Number.isInteger(pricePence) || pricePence < 0) issues.push('price');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) issues.push('capacity');
  if (!formatsValid || formats.length < 1) issues.push('formats');
  if (!description) issues.push('description');
  if (!descriptionZh) issues.push('description_zh');
  if (!status) issues.push('status');
  return issues;
}

export function validateSessionInput(
  input: SessionInput,
  validVenueIds: Iterable<string> = venues.map((venue) => venue.id),
): ValidatedSessionInput | null {
  const venueId = cleanString(input.venueId, 80);
  const date = cleanString(input.date, 10);
  const startTime = cleanString(input.startTime, 5);
  const endTime = cleanString(input.endTime, 5);
  const description = cleanString(input.description, 2000);
  const descriptionZh = cleanString(input.descriptionZh, 2000);
  const pricePence = Number(input.pricePence);
  const capacity = Number(input.capacity);
  const formatsInput = input.formats;
  const formats = formatsInput === undefined
    ? [...GAME_FORMATS]
    : Array.isArray(formatsInput)
      ? [...new Set(formatsInput as GameFormat[])]
      : [];
  const status = input.status === 'draft' ? 'draft' : input.status === 'published' ? 'published' : '';
  if (getSessionInputIssues(input, validVenueIds).length) return null;
  return {
    venueId,
    date,
    startTime,
    endTime,
    pricePence,
    capacity,
    formats,
    description,
    descriptionZh,
    status,
  };
}
