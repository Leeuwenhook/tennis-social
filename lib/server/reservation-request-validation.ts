export type ReservationRequestInput = {
  venueId?: unknown;
  preferredDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  contactName?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
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

export function validateReservationRequest(
  input: ReservationRequestInput,
  validVenueIds: Iterable<string>,
) {
  const venueId = cleanString(input.venueId, 80);
  const preferredDate = cleanString(input.preferredDate, 10);
  const startTime = cleanString(input.startTime, 5);
  const endTime = cleanString(input.endTime, 5);
  const contactName = cleanString(input.contactName, 120);
  const email = cleanString(input.email, 254).toLowerCase();
  const phone = cleanString(input.phone, 50);
  const message = cleanString(input.message, 1000);
  const today = new Date().toISOString().slice(0, 10);

  if (
    !new Set(validVenueIds).has(venueId) ||
    !isValidDate(preferredDate) || preferredDate < today ||
    !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) ||
    minutes(startTime) < 0 || minutes(startTime) > 1439 ||
    minutes(endTime) < 1 || minutes(endTime) > 1440 ||
    minutes(endTime) <= minutes(startTime) ||
    !contactName || !/^\S+@\S+\.\S+$/.test(email)
  ) return null;

  return { venueId, preferredDate, startTime, endTime, contactName, email, phone, message };
}
