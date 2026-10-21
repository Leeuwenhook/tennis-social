/** Venue form rules shared by the admin editor and the venue API. */

export const COURT_SETTINGS = ['indoor', 'outdoor', 'mixed'] as const;
export type CourtSetting = typeof COURT_SETTINGS[number];

export const MAX_COURT_COUNT = 100;
export const MAX_FREE_CANCELLATION_HOURS = 720;
export const MAX_VENUE_PRICE_PENCE = 100_000;

export type VenueFieldIssue =
  | 'name'
  | 'area'
  | 'photos'
  | 'peakPrice'
  | 'offPeakPrice'
  | 'priceOrder'
  | 'courtCount'
  | 'courtSetting'
  | 'floodlights'
  | 'freeCancellationHours';

/** Pounds as typed in the form, at most two decimal places. Returns pence, or null when invalid. */
export function parsePriceInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const pence = Math.round(Number(trimmed) * 100);
  return pence <= MAX_VENUE_PRICE_PENCE ? pence : null;
}

export function formatPriceInput(pence: number) {
  return (pence / 100).toFixed(2);
}

/** Empty means "not known yet"; otherwise a whole number of courts. */
export function parseCourtCountInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}$/.test(trimmed)) return undefined;
  const count = Number(trimmed);
  return count >= 1 && count <= MAX_COURT_COUNT ? count : undefined;
}

/** Empty means "not known yet"; otherwise whole hours of notice (0 = free to cancel until the start). */
export function parseFreeCancellationHoursInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}$/.test(trimmed)) return undefined;
  const hours = Number(trimmed);
  return hours <= MAX_FREE_CANCELLATION_HOURS ? hours : undefined;
}

export function isFreeCancellationHours(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_FREE_CANCELLATION_HOURS;
}

export function isCourtSetting(value: unknown): value is CourtSetting {
  return typeof value === 'string' && (COURT_SETTINGS as readonly string[]).includes(value);
}

export type VenueFormValues = {
  name: string;
  area: string;
  photos: string[];
  peakPrice: string;
  offPeakPrice: string;
  courtCount: string;
  freeCancellationHours: string;
};

export function venueFormIssues(values: VenueFormValues): VenueFieldIssue[] {
  const issues: VenueFieldIssue[] = [];
  if (!values.name.trim()) issues.push('name');
  if (!values.area.trim()) issues.push('area');
  if (!values.photos.some((photo) => photo.trim())) issues.push('photos');
  const peak = parsePriceInput(values.peakPrice);
  const offPeak = parsePriceInput(values.offPeakPrice);
  if (peak === null) issues.push('peakPrice');
  if (offPeak === null) issues.push('offPeakPrice');
  if (peak !== null && offPeak !== null && peak < offPeak) issues.push('priceOrder');
  if (parseCourtCountInput(values.courtCount) === undefined) issues.push('courtCount');
  if (parseFreeCancellationHoursInput(values.freeCancellationHours) === undefined) issues.push('freeCancellationHours');
  return issues;
}
