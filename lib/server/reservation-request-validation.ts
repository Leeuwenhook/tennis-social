import { PREFERRED_SLOTS, requestExpiresOn } from '../partner-request-slots';
import { TENNIS_LEVELS } from './user-auth';

export type ReservationRequestInput = {
  preferredSlots?: unknown;
  wechat?: unknown; whatsapp?: unknown; preferredContact?: unknown;
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
  requestKind?: unknown;
  venueBookingStatus?: unknown;
  existingPlayerLevels?: unknown;
  seekingPlayerCount?: unknown;
  seekingLevels?: unknown;
  preferredFormat?: unknown;
  budgetPence?: unknown;
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
  const contacts = validateContactMethods(input);
  if (!contacts) return null;
  const tennisLevel = cleanString(input.tennisLevel, 8);
  const gameFormat = input.gameFormat;
  const requestKind = input.requestKind === undefined ? 'find_court' : input.requestKind;
  const venueBookingStatus = input.venueBookingStatus === undefined ? 'unknown' : input.venueBookingStatus;
  const preferredFormat = input.preferredFormat === undefined ? 'flexible' : input.preferredFormat;
  const parseLevels = (value: unknown) => Array.isArray(value) ? value.filter((level): level is string => typeof level === 'string' && TENNIS_LEVELS.includes(level as never)).slice(0, 10) : [];
  const existingPlayerLevels = parseLevels(input.existingPlayerLevels);
  const seekingLevels = parseLevels(input.seekingLevels);
  const seekingPlayerCount = input.seekingPlayerCount === undefined ? 0 : input.seekingPlayerCount;
  const budgetPence = input.budgetPence === undefined || input.budgetPence === null || input.budgetPence === '' ? null : input.budgetPence;
  if (input.needsPartner !== undefined && input.needsPartner !== true && input.needsPartner !== false) return null;
  if (input.needsPartner === true && (!TENNIS_LEVELS.some((level) => level === tennisLevel) || (gameFormat !== 'singles' && gameFormat !== 'doubles'))) return null;
  const partnerSummary = input.needsPartner === true
    ? `Partner matching: Yes; Tennis level: ${tennisLevel}; Format: ${gameFormat === 'singles' ? 'Singles' : 'Doubles'}.`
    : input.needsPartner === false ? 'Partner matching: No.' : '';
  const message = [partnerSummary, cleanString(input.message, 1000)].filter(Boolean).join('\n').slice(0, 1000);
  const today = new Date().toISOString().slice(0, 10);
  const preferredSlots = Array.isArray(input.preferredSlots) ? [...new Set(input.preferredSlots)] : [];
  if ((input.preferredSlots !== undefined && !Array.isArray(input.preferredSlots)) || !preferredSlots.every((slot) => PREFERRED_SLOTS.includes(slot as never))) return null;
  if (venueBookingStatus === 'booked' ? !preferredDate : preferredSlots.length < 1) return null;
  const hasSchedule = Boolean(preferredDate || startTime || endTime);
  if (hasSchedule && (!isValidDate(preferredDate) || preferredDate < today ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(endTime) ||
    minutes(endTime) <= minutes(startTime))) return null;


  if (
    !requestType ||
    (requestType === 'known_venue' ? !venueName : !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(postcode)) ||
    !contactName || !/^\S+@\S+\.\S+$/.test(email)
  ) return null;

  const levelsValid = (raw: unknown, parsed: string[]) => raw === undefined || (Array.isArray(raw) && parsed.length === raw.length);
  if (
    !['find_partners', 'find_court', 'find_both'].includes(requestKind as string) ||
    !['booked', 'not_booked', 'unknown'].includes(venueBookingStatus as string) ||
    !['singles', 'doubles', 'practice', 'flexible'].includes(preferredFormat as string) ||
    typeof seekingPlayerCount !== 'number' || !Number.isInteger(seekingPlayerCount) || seekingPlayerCount < 0 || seekingPlayerCount > 100 ||
    (budgetPence !== null && (typeof budgetPence !== 'number' || !Number.isInteger(budgetPence) || budgetPence < 0)) ||
    !levelsValid(input.existingPlayerLevels, existingPlayerLevels) ||
    !levelsValid(input.seekingLevels, seekingLevels)
  ) return null;
  if (requestKind === 'find_partners' && requestType !== 'known_venue') return null;
  // A court-only request needs nobody; a partner search must need at least one player.
  if (requestKind === 'find_court' ? seekingPlayerCount !== 0 : seekingPlayerCount < 1) return null;

  return { requestType, venueId: requestType === 'known_venue' ? venueId : null, venueName: requestType === 'known_venue' ? venueName : '', postcode: requestType === 'find_nearby' ? postcode : '', preferredDate: preferredDate || null, startTime: startTime || null, endTime: endTime || null, preferredSlots: preferredSlots as string[], expiresOn: requestExpiresOn(preferredDate || null), ...contacts, contactName, email, message, requestKind, venueBookingStatus, existingPlayerLevels, seekingPlayerCount, seekingLevels, preferredFormat, budgetPence };
}

export type PartnerRequestApplicationInput = {
  name?: unknown; email?: unknown; phone?: unknown; wechat?: unknown; whatsapp?: unknown; preferredContact?: unknown; tennisLevel?: unknown;
  preferredFormat?: unknown; message?: unknown;
};

export function validatePartnerRequestApplication(input: PartnerRequestApplicationInput) {
  const name = cleanString(input.name, 120);
  const email = cleanString(input.email, 254).toLowerCase();
  const contacts = validateContactMethods(input);
  if (!contacts) return null;
  const tennisLevel = cleanString(input.tennisLevel, 8);
  const preferredFormat = cleanString(input.preferredFormat, 20);
  const message = cleanString(input.message, 1000);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !TENNIS_LEVELS.includes(tennisLevel as never) || !['singles', 'doubles', 'practice', 'flexible'].includes(preferredFormat)) return null;
  return { name, email, ...contacts, tennisLevel, preferredFormat, message };
}

export function validateContactMethods(input: { phone?: unknown; wechat?: unknown; whatsapp?: unknown; preferredContact?: unknown }) {
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const whatsapp = typeof input.whatsapp === 'string' ? input.whatsapp.trim() : '';
  const wechat = typeof input.wechat === 'string' ? input.wechat.trim() : '';
  const preferredContact = input.preferredContact === undefined ? 'email' : input.preferredContact;
  const values = { phone, whatsapp, wechat };
  if ((phone && !/^\+?[0-9()-]{6,20}$/.test(phone.replace(/\s/g, ''))) ||
      (whatsapp && !/^\+?[0-9()-]{6,20}$/.test(whatsapp.replace(/\s/g, ''))) || wechat.length > 40 ||
      !['email', 'phone', 'wechat', 'whatsapp'].includes(preferredContact as string) ||
      (preferredContact !== 'email' && !values[preferredContact as keyof typeof values])) return null;
  return { ...values, preferredContact: preferredContact as 'email' | 'phone' | 'wechat' | 'whatsapp' };
}
