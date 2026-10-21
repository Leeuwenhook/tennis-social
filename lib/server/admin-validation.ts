import { GAME_FORMATS, venues, type GameFormat } from '../demo-data';
import {
  isCourtSetting,
  MAX_COURT_COUNT,
  MAX_VENUE_PRICE_PENCE,
  type CourtSetting,
  type VenueFieldIssue,
} from '../venue-form';

const TENNIS_LEVELS = new Set(['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0']);

export type VenueInput = {
  description?: unknown;
  descriptionZh?: unknown;
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
  courtCount?: unknown;
  courtSetting?: unknown;
  floodlights?: unknown;
};

export type ValidatedVenueInput = {
  description: string | null;
  descriptionZh: string | null;
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
  courtCount: number | null;
  courtSetting: CourtSetting | null;
  floodlights: boolean | null;
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
  status?: unknown;
  markedFull?: unknown;
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
  status: 'published' | 'draft';
};

export type SessionValidationIssue =
  | 'venue'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'timeRange'
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

function pricePence(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  const pence = Number(text);
  return text && Number.isInteger(pence) && pence >= 0 && pence <= MAX_VENUE_PRICE_PENCE ? pence : null;
}

function venuePhotos(input: VenueInput) {
  const rawPhoto = typeof input.photo === 'string' ? input.photo.trim() : '';
  const rawPhotos = Array.isArray(input.photos) ? input.photos.filter((photo): photo is string => typeof photo === 'string' && Boolean(photo.trim())).map((photo) => photo.trim()) : [];
  return rawPhotos.length ? rawPhotos : rawPhoto ? [rawPhoto] : [];
}

const isSafePhoto = (photo: string) => photo.startsWith('/') || /^https?:\/\//i.test(photo) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(photo);

/** Field-level problems with a venue payload; empty when it can be saved. */
export function venueInputIssues(input: VenueInput): VenueFieldIssue[] {
  const issues: VenueFieldIssue[] = [];
  if (!cleanString(input.name, 120) || !cleanString(input.nameZh, 120)) issues.push('name');
  if (!cleanString(input.area, 120) || !cleanString(input.areaZh, 120)) issues.push('area');
  const photos = venuePhotos(input);
  if (!photos.length || photos.some((photo) => photo.length > 2_500_000 || !isSafePhoto(photo))) issues.push('photos');
  const peak = pricePence(input.peakPricePence);
  const offPeak = pricePence(input.offPeakPricePence);
  if (peak === null) issues.push('peakPrice');
  if (offPeak === null) issues.push('offPeakPrice');
  if (peak !== null && offPeak !== null && peak < offPeak) issues.push('priceOrder');
  const courtCount = input.courtCount ?? null;
  if (courtCount !== null && (!Number.isInteger(courtCount) || (courtCount as number) < 1 || (courtCount as number) > MAX_COURT_COUNT)) issues.push('courtCount');
  if ((input.courtSetting ?? null) !== null && !isCourtSetting(input.courtSetting)) issues.push('courtSetting');
  if ((input.floodlights ?? null) !== null && typeof input.floodlights !== 'boolean') issues.push('floodlights');
  return issues;
}

export function validateVenueInput(input: VenueInput): ValidatedVenueInput | null {
  if (venueInputIssues(input).length) return null;
  const photos = venuePhotos(input);
  return {
    description: cleanString(input.description, 2000) || null,
    descriptionZh: cleanString(input.descriptionZh, 2000) || null,
    name: cleanString(input.name, 120),
    nameZh: cleanString(input.nameZh, 120),
    area: cleanString(input.area, 120),
    areaZh: cleanString(input.areaZh, 120),
    address: cleanString(input.address, 300),
    addressZh: cleanString(input.addressZh, 300),
    postcode: cleanString(input.postcode, 20).toUpperCase(),
    photo: photos[0],
    photos,
    notes: cleanString(input.notes, 1000),
    peakPricePence: pricePence(input.peakPricePence) as number,
    offPeakPricePence: pricePence(input.offPeakPricePence) as number,
    courtCount: (input.courtCount as number | null | undefined) ?? null,
    courtSetting: isCourtSetting(input.courtSetting) ? input.courtSetting : null,
    floodlights: typeof input.floodlights === 'boolean' ? input.floodlights : null,
  };
}

export function validateSessionInput(
  input: SessionInput,
  validVenueIds: Iterable<string> = venues.map((venue) => venue.id),
): ValidatedSessionInput | null {
  const venueId = cleanString(input.venueId, 80);
  const date = cleanString(input.date, 10);
  const startTime = cleanString(input.startTime, 5);
  const endTime = cleanString(input.endTime, 5);
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
  if (!Number.isInteger(pricePence) || pricePence < 0) issues.push('price');
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 1000) issues.push('capacity');
  if (!formatsValid || formats.length < 1) issues.push('formats');
  if (!seekingLevelsValid) issues.push('seekingLevels');
  if (!status) issues.push('status');
  return issues;
}
