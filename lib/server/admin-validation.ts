import { GAME_FORMATS, venues, type GameFormat } from '../demo-data';

const TENNIS_LEVELS = new Set(['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0']);

export type VenueInput = {
  name?: unknown;
  nameZh?: unknown;
  area?: unknown;
  areaZh?: unknown;
  address?: unknown;
  addressZh?: unknown;
  postcode?: unknown;
  photo?: unknown;
  photos?: unknown;
  notes?: unknown;
  peakPricePence?: unknown;
  offPeakPricePence?: unknown;
};

export type ValidatedVenueInput = {
  name: string;
  nameZh: string;
  area: string;
  areaZh: string;
  address: string;
  addressZh: string;
  postcode: string;
  photo: string;
  photos: string[];
  notes: string;
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
  seekingLevels?: unknown;
  description?: unknown;
  descriptionZh?: unknown;
  status?: unknown;
};

export type ValidatedSessionInput = {
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  pricePence: number;
  capacity: number;
  formats: GameFormat[];
  seekingLevels: string[];
  description: string;
  descriptionZh: string;
  status: 'published' | 'draft';
};

export type SessionValidationIssue =
  | 'venue'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'timeRange'
  | 'description'
  | 'price'
  | 'capacity'
  | 'formats'
  | 'seekingLevels'
  | 'status';

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
  const rawPhoto = typeof input.photo === 'string' ? input.photo.trim() : '';
  const rawPhotos = Array.isArray(input.photos) ? input.photos.filter((photo): photo is string => typeof photo === 'string' && Boolean(photo.trim())).map((photo) => photo.trim()) : [];
  const photos = rawPhotos.length ? rawPhotos : rawPhoto ? [rawPhoto] : [];
  const primaryPhoto = photos[0] ?? '';
  const notes = cleanString(input.notes, 1000);
  const address = cleanString(input.address, 300);
  const addressZh = cleanString(input.addressZh, 300);
  const postcode = cleanString(input.postcode, 20).toUpperCase();
  const peakPriceValue = typeof input.peakPricePence === 'string'
    ? input.peakPricePence.trim()
    : typeof input.peakPricePence === 'number' ? String(input.peakPricePence) : '';
  const offPeakPriceValue = typeof input.offPeakPricePence === 'string'
    ? input.offPeakPricePence.trim()
    : typeof input.offPeakPricePence === 'number' ? String(input.offPeakPricePence) : '';
  const peakPricePence = Number(peakPriceValue);
  const offPeakPricePence = Number(offPeakPriceValue);
  const isSafePhoto = (photo: string) => photo.startsWith('/') || /^https?:\/\//i.test(photo) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(photo);
  if (
    !name || !nameZh || !area || !areaZh || !photos.length || photos.some((photo) => photo.length > 2_500_000 || !isSafePhoto(photo)) || !peakPriceValue || !offPeakPriceValue ||
    !Number.isInteger(peakPricePence) || peakPricePence < 0 || peakPricePence > 100_000 ||
    !Number.isInteger(offPeakPricePence) || offPeakPricePence < 0 || offPeakPricePence > 100_000 ||
    peakPricePence < offPeakPricePence
  ) return null;
  return { name, nameZh, area, areaZh, address, addressZh, postcode, photo: primaryPhoto, photos, notes, peakPricePence, offPeakPricePence };
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
  const seekingLevels = Array.isArray(input.seekingLevels)
    ? [...new Set(input.seekingLevels.filter((level): level is string => typeof level === 'string' && TENNIS_LEVELS.has(level.trim())).map((level) => level.trim()))]
    : [];
  const formats = formatsInput === undefined
    ? [...GAME_FORMATS]
    : Array.isArray(formatsInput)
      ? [...new Set(formatsInput as GameFormat[])]
      : [];
  const status: 'draft' | 'published' | '' = input.status === 'draft' ? 'draft' : input.status === 'published' ? 'published' : '';
  if (sessionInputIssues(input, validVenueIds).length) return null;
  return {
    venueId,
    date,
    startTime,
    endTime,
    pricePence,
    capacity,
    formats,
    seekingLevels,
    description,
    descriptionZh,
    status: status as 'draft' | 'published',
  };
}

export function sessionInputIssues(
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
  const seekingLevelsInput = input.seekingLevels;
  const seekingLevelsValid = seekingLevelsInput === undefined || (Array.isArray(seekingLevelsInput) && seekingLevelsInput.every((level) => typeof level === 'string' && TENNIS_LEVELS.has(level.trim())));
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
  const validStartTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) && minutes(startTime) >= 0 && minutes(startTime) <= 1439;
  const validEndTime = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(endTime) && minutes(endTime) >= 1 && minutes(endTime) <= 1440;

  if (!new Set(validVenueIds).has(venueId)) issues.push('venue');
  if (!isDate(date)) issues.push('date');
  if (!validStartTime) issues.push('startTime');
  if (!validEndTime) issues.push('endTime');
  if (validStartTime && validEndTime && minutes(endTime) <= minutes(startTime)) issues.push('timeRange');
  if (!description || !descriptionZh) issues.push('description');
  if (!Number.isInteger(pricePence) || pricePence < 0) issues.push('price');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) issues.push('capacity');
  if (!formatsValid || formats.length < 1) issues.push('formats');
  if (!seekingLevelsValid) issues.push('seekingLevels');
  if (!status) issues.push('status');
  return issues;
}
