import type { ReservationRequestForm } from '@/types/tennis';

export type PartnerRequestDraft = Partial<Pick<ReservationRequestForm,
  'venueName' | 'preferredDate' | 'startTime' | 'endTime' | 'existingPlayerLevels' |
  'seekingLevels' | 'seekingPlayerCount' | 'preferredFormat' | 'fullDurationRequired' |
  'venueBookingStatus' | 'requestKind'>> & {
  missing: Array<'preferredDate' | 'time' | 'seekingPlayerCount'>;
  source: string;
};

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const LEVELS = new Set(['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0']);

function toTime(value: string, meridiem?: string) {
  const [hourText, minuteText = '00'] = value.split(':');
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return '';
  if (meridiem) {
    const pm = meridiem.toLowerCase() === 'pm';
    if (hour < 1 || hour > 12) return '';
    hour = hour % 12 + (pm ? 12 : 0);
  }
  if (hour > 23) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseDate(text: string) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const slash = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  const named = text.match(/\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)?\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (!named) return '';
  return `${named[3]}-${String(MONTHS[named[2].toLowerCase()]).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
}

export function parsePartnerRequestDraft(source: string): PartnerRequestDraft {
  const text = source.trim();
  const result: PartnerRequestDraft = { missing: [], source };
  const venue = text.match(/(?:at|venue|court|场地)\s*[:：-]?\s*([A-Za-z][A-Za-z0-9 &'’.-]{2,80}?)(?=\s+(?:on|at|from|\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|$))/i);
  if (venue) result.venueName = venue[1].trim().replace(/[,.]$/, '');
  const date = parseDate(text);
  if (date) result.preferredDate = date;

  const range = text.match(/\b(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?\b/i);
  if (range) {
    const endMeridiem = range[5] || range[2];
    result.startTime = toTime(range[1], range[2] || range[5]);
    result.endTime = toTime(range[3], endMeridiem);
  }
  const levels = [...text.matchAll(/\b([1-5](?:\.0|\.5))\b/g)].map((match) => match[1]).filter((level) => LEVELS.has(level));
  if (levels.length) {
    result.existingPlayerLevels = [levels[0]];
    result.seekingLevels = [...new Set(levels.slice(1))];
  }
  const count = text.match(/(?:need|missing|缺|还需|找)\s*(\d{1,2})\s*(?:players?|people|人)?/i);
  if (count) result.seekingPlayerCount = Number(count[1]);
  const duration = /full\s*duration|whole\s*(?:time|session)|全程|连续\s*\d+\s*小时/i.test(text);
  if (duration) result.fullDurationRequired = true;
  const hours = text.match(/(?:for|连续|duration)\s*(\d+(?:\.5)?)\s*(?:hours?|小时)/i);
  if (hours && result.startTime && !result.endTime) {
    const endMinutes = Number(result.startTime.slice(0, 2)) * 60 + Number(result.startTime.slice(3)) + Number(hours[1]) * 60;
    if (endMinutes <= 24 * 60) result.endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  }
  if (/singles?|单打/i.test(text)) result.preferredFormat = 'singles';
  else if (/doubles?|双打/i.test(text)) result.preferredFormat = 'doubles';
  else if (/practice|练球/i.test(text)) result.preferredFormat = 'practice';
  if (/booked|reserved|已订|已预订/i.test(text)) result.venueBookingStatus = 'booked';
  else if (/not\s*booked|unbooked|未订|未预订/i.test(text)) result.venueBookingStatus = 'not_booked';
  if (result.venueName) result.requestKind = result.venueBookingStatus === 'booked' ? 'find_partners' : 'find_both';
  if (!result.preferredDate) result.missing.push('preferredDate');
  if (!result.startTime || !result.endTime) result.missing.push('time');
  if (result.seekingPlayerCount === undefined) result.missing.push('seekingPlayerCount');
  return result;
}

export const parsePartnerRequestText = parsePartnerRequestDraft;
export const parsePastedPartnerRequest = parsePartnerRequestDraft;
