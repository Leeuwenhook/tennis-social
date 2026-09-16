import { GAME_FORMATS, venues, type GameFormat } from '../demo-data';

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

export function validateSessionInput(input: SessionInput): ValidatedSessionInput | null {
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
  if (
    !venues.some((venue) => venue.id === venueId) ||
    !isDate(date) ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    !/^\d{2}:\d{2}$/.test(endTime) ||
    minutes(startTime) < 0 || minutes(startTime) > 1439 ||
    minutes(endTime) < 1 || minutes(endTime) > 1440 ||
    minutes(endTime) <= minutes(startTime) ||
    !description || !descriptionZh ||
    !Number.isInteger(pricePence) || pricePence < 0 ||
    !Number.isInteger(capacity) || capacity < 1 || capacity > 1000 ||
    !formatsValid || formats.length < 1 ||
    !status
  ) return null;
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
