import {
  createDemoSessions,
  DEFAULT_OFF_PEAK_PRICE_PENCE,
  DEFAULT_PEAK_PRICE_PENCE,
  GAME_FORMATS,
  venues,
  type GameFormat,
  type Venue,
} from '@/lib/demo-data';
import { parseMinutes } from '@/lib/formatters';
import type {
  Booking,
  BookingStage,
  ProfileForm,
  Session,
  SessionBookingPreference,
  SessionDraft,
  UserProfile,
  VenueDraft,
  View,
} from '@/types/tennis';

export const LEVELS = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'] as const;
export const PREFERRED_TIMES = ['weekends', 'weekday_evenings', 'anytime', 'mornings', 'afternoons'] as const;
export const SESSION_STORAGE_KEY = 'tennis-social-sessions-v2';
export const BOOKING_STORAGE_KEY = 'tennis-social-bookings-v2';
export const VENUE_STORAGE_KEY = 'tennis-social-venues-v1';
export const LANGUAGE_STORAGE_KEY = 'tennis-social-language-v1';
export const ROUTE_VIEWS: View[] = ['home', 'detail', 'booking', 'confirmation', 'account', 'request', 'admin'];

export function routeStateFromLocation(): { view: View; sessionId: string | null; bookingStage: BookingStage } {
  if (typeof window === 'undefined') return { view: 'home', sessionId: null, bookingStage: 'details' };
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/admin') return { view: 'admin', sessionId: null, bookingStage: 'details' };
  const query = new URLSearchParams(window.location.search);
  const candidate = query.get('view');
  const view = candidate && ROUTE_VIEWS.includes(candidate as View) ? (candidate as View) : 'home';
  return {
    view,
    sessionId: query.get('session') || null,
    bookingStage: query.get('stage') === 'payment' ? 'payment' : 'details',
  };
}

export function getVenue(venueId: string, venueList: Venue[] = venues): Venue {
  return venueList.find((venue) => venue.id === venueId) ?? venueList[0] ?? venues[0];
}

export function normalizeLocation(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function venueLabel(venue: Venue) {
  return venue.name;
}

export function venueSearchText(venue: Venue) {
  return [venue.name, venue.nameZh, venue.area, venue.areaZh].join(' ').toLocaleLowerCase();
}

export function validFormats(value: unknown): GameFormat[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((format): format is GameFormat => GAME_FORMATS.includes(format as GameFormat)))];
}

export function normalizeFormats(value: unknown): GameFormat[] {
  const formats = validFormats(value);
  return formats.length ? formats : [...GAME_FORMATS];
}

export function normalizeBookingPreferences(value: unknown): SessionBookingPreference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const preference = item as { level?: unknown; format?: unknown };
    if (typeof preference.level !== 'string' || !preference.level.trim()) return [];
    if (!GAME_FORMATS.includes(preference.format as GameFormat)) return [];
    return [{ level: preference.level.trim(), format: preference.format as GameFormat }];
  });
}

export function bookingPreferencesFromBookings(sessionId: string, bookings: Booking[]): SessionBookingPreference[] {
  return bookings
    .filter((booking) => booking.sessionId === sessionId && booking.status === 'confirmed')
    .flatMap((booking) => booking.participants.map((level) => ({ level, format: booking.format })));
}

export function summarizeBookingPreferences(preferences: SessionBookingPreference[]) {
  const counts = new Map<string, SessionBookingPreference & { count: number }>();
  for (const preference of preferences) {
    const key = `${preference.level}:${preference.format}`;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { ...preference, count: 1 });
  }
  return [...counts.values()];
}

export function profileFormFromUser(user: UserProfile): ProfileForm {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    postcode: user.postcode,
    tennisLevel: user.tennisLevel,
    preferredTime: user.preferredTime,
    preferredFormat: user.preferredFormat,
  };
}

export function normalizeSession(session: Session): Session {
  const rawPreferences = (session as Session & { bookingPreferences?: unknown }).bookingPreferences;
  const rawSeekingLevels = (session as Session & { seekingLevels?: unknown }).seekingLevels;
  return {
    ...session,
    formats: normalizeFormats((session as Session & { formats?: unknown }).formats),
    seekingLevels: Array.isArray(rawSeekingLevels)
      ? [
          ...new Set(
            rawSeekingLevels.filter(
              (level): level is string => typeof level === 'string' && (LEVELS as readonly string[]).includes(level),
            ),
          ),
        ]
      : [],
    bookingPreferences: Array.isArray(rawPreferences) ? normalizeBookingPreferences(rawPreferences) : undefined,
  };
}

export function normalizeBooking(booking: Booking): Booking {
  const format = (booking as Booking & { format?: unknown }).format;
  return {
    ...booking,
    format: GAME_FORMATS.includes(format as GameFormat) ? (format as GameFormat) : 'singles',
    couponDiscountPence: Number(booking.couponDiscountPence ?? 0),
    loyaltyDiscountPercent: Number(booking.loyaltyDiscountPercent ?? 0),
    loyaltyDiscountPence: Number(booking.loyaltyDiscountPence ?? 0),
  };
}

export function normalizeVenue(value: unknown): Venue | null {
  if (!value || typeof value !== 'object') return null;
  const venue = value as Partial<Venue>;
  if (
    typeof venue.id !== 'string' ||
    typeof venue.name !== 'string' ||
    typeof venue.nameZh !== 'string' ||
    typeof venue.area !== 'string' ||
    typeof venue.areaZh !== 'string' ||
    typeof venue.photo !== 'string'
  )
    return null;
  const peakPricePence = Number(venue.peakPricePence);
  const offPeakPricePence = Number(venue.offPeakPricePence);
  if (!Number.isInteger(peakPricePence) || !Number.isInteger(offPeakPricePence)) return null;
  const photos = Array.isArray(venue.photos)
    ? venue.photos.filter((photo): photo is string => typeof photo === 'string' && photo.trim().length > 0)
    : [];
  if (!photos.length && venue.photo.trim()) photos.push(venue.photo);
  return {
    id: venue.id,
    name: venue.name,
    nameZh: venue.nameZh,
    area: venue.area,
    areaZh: venue.areaZh,
    photo: venue.photo,
    photos,
    notes: typeof venue.notes === 'string' ? venue.notes : '',
    peakPricePence,
    offPeakPricePence,
  };
}

export function isPast(session: Session) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const londonNow = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
  return `${session.date}T${session.endTime}:00` <= londonNow;
}

export function sessionSort(a: Session, b: Session) {
  return `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`);
}

export function dateFromToday(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekStart(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDay();
  return shiftDate(value, day === 0 ? -6 : 1 - day);
}

export function emptyDraft(venueList: Venue[] = venues): SessionDraft {
  const defaultDate = createDemoSessions()[6]?.date ?? createDemoSessions()[0]?.date ?? '';
  const venue = getVenue(venueList[0]?.id ?? venues[0].id, venueList);
  return {
    id: null,
    venueId: venue.id,
    date: defaultDate,
    startTime: '18:30',
    endTime: '20:30',
    price: String(venue.offPeakPricePence / 100),
    capacity: '8',
    formats: [...GAME_FORMATS],
    seekingLevels: [],
    description: 'A friendly tennis session for new and returning players.',
    descriptionZh: '适合新朋友和熟悉球友的轻松网球活动。',
    status: 'published',
  };
}

export function emptyVenueDraft(venueList: Venue[] = venues): VenueDraft {
  const venue = venueList[0];
  return {
    id: null,
    name: '',
    area: '',
    photo: '',
    photos: [],
    notes: '',
    peakPrice: String((venue?.peakPricePence ?? DEFAULT_PEAK_PRICE_PENCE) / 100),
    offPeakPrice: String((venue?.offPeakPricePence ?? DEFAULT_OFF_PEAK_PRICE_PENCE) / 100),
  };
}

export function sessionOverlaps(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
) {
  return parseMinutes(a.startTime) < parseMinutes(b.endTime) && parseMinutes(b.startTime) < parseMinutes(a.endTime);
}

export function sessionPayload(session: Session, status = session.status) {
  return {
    venueId: session.venueId,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    pricePence: session.pricePence,
    capacity: session.capacity,
    formats: session.formats,
    seekingLevels: session.seekingLevels ?? [],
    description: session.description,
    descriptionZh: session.descriptionZh,
    status,
  };
}
