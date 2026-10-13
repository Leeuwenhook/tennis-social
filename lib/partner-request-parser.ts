import type { ReservationRequestForm } from '../types/tennis';

export type PartnerRequestDraft = Partial<Pick<ReservationRequestForm,
  'venueName' | 'preferredDate' | 'startTime' | 'endTime' | 'existingPlayerLevels' |
  'seekingLevels' | 'seekingPlayerCount' | 'preferredFormat' | 'fullDurationRequired' |
  'venueBookingStatus' | 'requestKind'>> & {
  missing: Array<'preferredDate' | 'time' | 'seekingPlayerCount'>;
  source: string;
};

const LIST_MARKER = /^\s*(?:[-*•·]|\d{1,2}[.)])\s+/;
const VENUE_SUFFIX = /^(.*?(?:\b(?:park|courts?|club|centre|center|grounds?|gardens?|common|fields?)\b|公园|网球中心|网球场|球场))/i;
const TIME_RANGE = /(?<![\d.:])(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*(?:-|–|—|~|to|至|到)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?(?![\d.:])/gi;
const SINGLE_TIME = /(?<![\d.:])(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?![\d.:])/gi;
const DURATION = /(?:for|连续|duration|持续)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|小时)/gi;
const LEVEL_RANGE = /(?<![\d.])[1-5]\.[05]\s*[-–—~至到]\s*[1-5]\.[05](?![\d.])/g;
const DECIMAL_LEVEL = /(?<![\d.])([1-5]\.[05])(?![\d.])/g;
const TRAILING_PARENTHETICAL = /\s*[（(][^()（）]*[）)]\s*$/;

function cleanVenue(value: string) {
  const withoutTail = value.replace(TRAILING_PARENTHETICAL, '').trim();
  return (withoutTail.match(VENUE_SUFFIX)?.[1] ?? withoutTail.replace(/\s+(?:on|from)\b.*$|\s+\d.*$/i, '')).trim();
}

function venueFromFirstLine(text: string) {
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? '';
  const candidate = firstLine.split(/\s*[/|｜,，]\s*/)[0].trim();
  if (candidate.length < 3 || /^(?:date|日期|time|时间|venue|场地)\s*[:：]/i.test(candidate)) return '';
  const suffixed = candidate.match(VENUE_SUFFIX)?.[1]?.replace(/^.*\bat\s+/i, '').trim();
  if (suffixed && /^[A-Za-z一-鿿]/.test(suffixed)) return suffixed;
  if (/[（(][^()（）]*[）)]$/.test(candidate) && !/\d/.test(candidate)) return candidate.replace(TRAILING_PARENTHETICAL, '').trim();
  return '';
}

function parseVenue(text: string) {
  const labelled = text.match(/(?:^|[\s,，;；])(?:venue|court|location|场地|地点)\s*[:：]\s*([^,，;；\n/|｜]{2,80})/i);
  if (labelled) return cleanVenue(labelled[1]);
  const firstLine = venueFromFirstLine(text);
  if (firstLine) return firstLine;
  const at = text.match(/\b[Aa]t\s+([A-Z][A-Za-z0-9 &'’.-]{2,80}?)(?=\s*(?:[,，(（/|]|\bon\b|\bat\b|\bfrom\b|\d|$))/m);
  return at ? cleanVenue(at[1]) : '';
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const LEVELS = new Set(['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0']);

function toMinutes(hourText: string, minuteText = '00', meridiem?: string) {
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return -1;
  if (meridiem) {
    if (hour < 1 || hour > 12) return -1;
    hour = hour % 12 + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  }
  if (hour > 23) return -1;
  return hour * 60 + minute;
}

function clockMinutes(value: string, meridiem?: string) {
  const [hour, minute] = value.split(':');
  return toMinutes(hour, minute, meridiem);
}

function formatMinutes(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function parseTimeRange(start: string, startMeridiem: string | undefined, end: string, endMeridiem: string | undefined) {
  let endMinutes = clockMinutes(end, endMeridiem ?? startMeridiem);
  // "11am-1" means 11:00–13:00: an implied end meridiem that lands before the start shifts to pm.
  if (!endMeridiem && startMeridiem && endMinutes >= 0 && endMinutes < 12 * 60 && clockMinutes(start, startMeridiem) >= endMinutes) {
    endMinutes += 12 * 60;
  }
  let startMinutes = clockMinutes(start, startMeridiem ?? endMeridiem);
  // "11-1pm" means 11:00–13:00: only borrow the end meridiem when it keeps the start before the end.
  if (!startMeridiem && endMeridiem && startMinutes >= endMinutes) startMinutes = clockMinutes(start, 'am');
  if (startMinutes < 0 || endMinutes < 0 || startMinutes >= endMinutes) return null;
  return { startTime: formatMinutes(startMinutes), endTime: formatMinutes(endMinutes) };
}

function parseTimes(text: string, durationHours: number | undefined) {
  const ranges = [...text.matchAll(TIME_RANGE)];
  // Prefer an explicit clock range ("6-8pm", "18:00-20:00") over a bare "1-2" that may be a player count.
  const range = ranges.find((match) => match[2] || match[4] || match[1].includes(':') || match[3].includes(':')) ?? ranges[0];
  if (range) return parseTimeRange(range[1], range[2], range[3], range[4]);
  if (!durationHours || durationHours <= 0) return null;
  const single = [...text.matchAll(SINGLE_TIME)].find((match) => match[2] !== undefined || match[3]);
  if (!single) return null;
  const start = toMinutes(single[1], single[2], single[3]);
  const end = start + Math.round(durationHours * 60);
  if (start < 0 || end > 24 * 60) return null;
  return { startTime: formatMinutes(start), endTime: formatMinutes(end) };
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDate(text: string) {
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const slash = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
  if (slash) return validDate(Number(slash[3]), Number(slash[2]), Number(slash[1]));
  const named = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (!named) return '';
  return validDate(Number(named[3]), MONTHS[named[2].toLowerCase()], Number(named[1]));
}

export function parsePartnerRequestDraft(source: string): PartnerRequestDraft {
  const text = source.trim().split(/\r?\n/).map((line) => line.replace(LIST_MARKER, '')).join('\n');
  const result: PartnerRequestDraft = { missing: [], source };
  result.venueName = parseVenue(text).replace(/[,.]$/, '').trim() || undefined;
  const date = parseDate(text);
  if (date) result.preferredDate = date;

  const withoutDates = text
    .replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[/.]\d{1,2}[/.]20\d{2}\b/g, ' ');
  const durationHours = [...withoutDates.matchAll(DURATION)].map((match) => Number(match[1]))[0];
  const withoutDurations = withoutDates.replace(DURATION, ' ');
  const times = parseTimes(withoutDurations.replace(LEVEL_RANGE, ' ').replace(DECIMAL_LEVEL, ' '), durationHours);
  if (times) {
    result.startTime = times.startTime;
    result.endTime = times.endTime;
  }

  const levels = [...withoutDurations.matchAll(DECIMAL_LEVEL)].map((match) => match[1]).filter((level) => LEVELS.has(level));
  if (levels.length) {
    result.existingPlayerLevels = [levels[0]];
    result.seekingLevels = [...new Set(levels.slice(1))];
  }
  const count = text.match(/(?:need|missing|缺|还需|找)\s*(\d{1,2})\s*(?:players?|people|人)?/i);
  if (count) result.seekingPlayerCount = Number(count[1]);
  if (/full\s*duration|whole\s*(?:time|session)|全程|连续\s*\d+(?:\.\d+)?\s*小时/i.test(text)) result.fullDurationRequired = true;
  if (/singles?|单打/i.test(text)) result.preferredFormat = 'singles';
  else if (/doubles?|双打/i.test(text)) result.preferredFormat = 'doubles';
  else if (/practice|练球/i.test(text)) result.preferredFormat = 'practice';
  if (/not\s*(?:yet\s*)?booked|unbooked|未订|未预订/i.test(text)) result.venueBookingStatus = 'not_booked';
  else if (/booked|reserved|已订|已预订/i.test(text)) result.venueBookingStatus = 'booked';
  const partnerWording = /existing\s+players?|player\s+levels?|looking\s+for\s+(?:a\s+)?partner|find(?:ing)?\s+(?:a\s+)?partner|已有球友|球友(?:水平|等级)|寻找球友|找球友/i.test(text);
  if (result.venueName) result.requestKind = result.venueBookingStatus === 'booked' || partnerWording ? 'find_partners' : 'find_both';
  if (!result.preferredDate) result.missing.push('preferredDate');
  if (!result.startTime || !result.endTime) result.missing.push('time');
  if (result.seekingPlayerCount === undefined) result.missing.push('seekingPlayerCount');
  return result;
}

function startsVenueRequest(line: string) {
  const draft = parsePartnerRequestDraft(line);
  return Boolean(draft.venueName && draft.startTime && draft.endTime);
}

function splitBlock(block: string) {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [block];
  // Conservative: split only when every line is a list item naming a venue, or every line is a complete one-line request.
  const listOfVenues = lines.every((line) => LIST_MARKER.test(line) && parsePartnerRequestDraft(line).venueName);
  return listOfVenues || lines.every(startsVenueRequest) ? lines : [block];
}

export function parsePartnerRequestDrafts(source: string) {
  return source.split(/(?:\r?\n\s*){2,}/).map((block) => block.trim()).filter(Boolean).flatMap(splitBlock).map(parsePartnerRequestDraft);
}

export const parsePartnerRequestText = parsePartnerRequestDraft;
export const parsePastedPartnerRequest = parsePartnerRequestDraft;
