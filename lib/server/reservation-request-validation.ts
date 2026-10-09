import { TENNIS_LEVELS } from './user-auth';

export type ReservationRequestInput = {
  requestType?: unknown;
  venueId?: unknown;
  venueName?: unknown;
  postcode?: unknown;
  preferredDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
  needsPartner?: unknown;
  tennisLevel?: unknown;
  gameFormat?: unknown;
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function minutes(value: string) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

type VenueValidationRow = {
  id: string;
  name: string;
  nameZh: string;
  area: string;
  areaZh: string;
};

export function validateReservationRequest(
  input: ReservationRequestInput,
  venueRows: VenueValidationRow[] | Iterable<string>,
) {
  const requestedVenueId = cleanString(input.venueId, 80);
  const requestType = input.requestType === 'find_nearby' ? 'find_nearby' : input.requestType === 'known_venue' ? 'known_venue' : '';
  const requestedVenueName = cleanString(input.venueName, 160);
  const postcode = cleanString(input.postcode, 12).toUpperCase();
  const rows = [...venueRows];
  const detailedVenueRows: VenueValidationRow[] = rows.length && rows[0] !== null && typeof rows[0] === 'object'
    ? rows as VenueValidationRow[]
    : (rows as string[]).map((id) => ({ id, name: '', nameZh: '', area: '', areaZh: '' }));
  const validVenueIds = new Set(detailedVenueRows.map((venue) => venue.id));
  const matchedVenue = validVenueIds.has(requestedVenueId)
    ? detailedVenueRows.find((venue) => venue.id === requestedVenueId)
    : detailedVenueRows.find((venue) => [venue.name, venue.nameZh].some((name) => name.trim().toLocaleLowerCase() === requestedVenueName.toLocaleLowerCase()));
  const venueId = matchedVenue?.id ?? null;
  const venueName = matchedVenue?.name || requestedVenueName || matchedVenue?.id || '';
  const preferredDate = cleanString(input.preferredDate, 10);
  const startTime = cleanString(input.startTime, 5);
  const endTime = cleanString(input.endTime, 5);
  const contactName = cleanString(input.contactName, 120);
  const email = cleanString(input.email, 254).toLowerCase();
  const phone = cleanString(input.phone, 50);
  const tennisLevel = cleanString(input.tennisLevel, 8);
  const gameFormat = input.gameFormat;
  if (input.needsPartner !== undefined && input.needsPartner !== true && input.needsPartner !== false) return null;
  if (input.needsPartner === true && (!TENNIS_LEVELS.some((level) => level === tennisLevel) || (gameFormat !== 'singles' && gameFormat !== 'doubles'))) return null;
  const partnerSummary = input.needsPartner === true
    ? `Partner matching: Yes; Tennis level: ${tennisLevel}; Format: ${gameFormat === 'singles' ? 'Singles' : 'Doubles'}.`
    : input.needsPartner === false ? 'Partner matching: No.' : '';
  const message = [partnerSummary, cleanString(input.message, 1000)].filter(Boolean).join('\n').slice(0, 1000);
  const today = new Date().toISOString().slice(0, 10);

  if (
    !requestType ||
    (requestType === 'known_venue' ? !venueName : !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(postcode)) ||
    !isValidDate(preferredDate) || preferredDate < today ||
    !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) ||
    minutes(startTime) < 0 || minutes(startTime) > 1439 ||
    minutes(endTime) < 1 || minutes(endTime) > 1440 ||
    minutes(endTime) <= minutes(startTime) ||
    !contactName || !/^\S+@\S+\.\S+$/.test(email)
  ) return null;

  return { requestType, venueId: requestType === 'known_venue' ? venueId : null, venueName: requestType === 'known_venue' ? venueName : '', postcode: requestType === 'find_nearby' ? postcode : '', preferredDate, startTime, endTime, contactName, email, phone, message };
}
