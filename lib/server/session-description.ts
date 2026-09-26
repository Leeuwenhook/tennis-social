import { GAME_FORMATS, type GameFormat } from '../demo-data';

export type SessionDescriptionInput = {
  venueName: string;
  venueNameZh: string;
  date: string;
  startTime: string;
  endTime: string;
  formats: readonly GameFormat[];
  capacity: number;
};

function weekdayLabels(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return { english: '', chinese: '' };
  return {
    english: new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(parsed),
    chinese: new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'UTC' }).format(parsed),
  };
}

function formatLabels(formats: readonly GameFormat[]) {
  const validFormats = [...new Set(formats.filter((format) => GAME_FORMATS.includes(format)))];
  if (validFormats.length === 2) return { english: 'singles and doubles', chinese: '单打和双打' };
  if (validFormats[0] === 'singles') return { english: 'singles', chinese: '单打' };
  if (validFormats[0] === 'doubles') return { english: 'doubles', chinese: '双打' };
  return { english: 'singles and doubles', chinese: '单打和双打' };
}

export function generateSessionDescriptions(input: SessionDescriptionInput) {
  const venueName = input.venueName.trim() || 'the tennis courts';
  const venueNameZh = input.venueNameZh.trim() || '网球场';
  const { english: weekday, chinese: weekdayZh } = weekdayLabels(input.date);
  const formats = formatLabels(input.formats);
  const dayLabel = weekday ? `${weekday}, ` : '';
  const dayLabelZh = weekdayZh ? `（${weekdayZh}）` : '';
  const capacity = Number.isInteger(input.capacity) && input.capacity > 0 ? input.capacity : 0;
  const capacityText = capacity ? ` with up to ${capacity} players` : '';
  const capacityTextZh = capacity ? `，最多可容纳${capacity}人` : '';

  return {
    description: `A friendly ${formats.english} tennis session at ${venueName} on ${dayLabel}${input.date}, from ${input.startTime} to ${input.endTime}. Open to all levels${capacityText}.`,
    descriptionZh: `${input.date}${dayLabelZh}${input.startTime}–${input.endTime}，欢迎来到${venueNameZh}参加${formats.chinese}网球活动，适合各个水平的球友${capacityTextZh}。`,
  };
}
