export const PREFERRED_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type PreferredSlot = (typeof PREFERRED_SLOTS)[number];
/** Half-open local clock ranges; a session ending at noon does not include afternoon. */
export const PERIOD_RANGES = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening: [18 * 60, 24 * 60],
} as const;
export const SLOT_LABELS = {
  en: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
  zh: { morning: '上午', afternoon: '下午', evening: '晚上' },
};
export function slotLabels(slots: readonly string[] = [], language: 'en' | 'zh') {
  return PREFERRED_SLOTS.filter((slot) => slots.includes(slot))
    .map((slot) => SLOT_LABELS[language][slot]).join(' · ');
}
function clockMinutes(value: string, allowMidnight = false): number | null {
  if (allowMidnight && value === '24:00') return 1440;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
export function slotsForTimeRange(startTime: string, endTime: string): PreferredSlot[] {
  const start = clockMinutes(startTime);
  const end = clockMinutes(endTime, true);
  if (start === null || end === null || end <= start) return [];
  return PREFERRED_SLOTS.filter((slot) => start < PERIOD_RANGES[slot][1] && end > PERIOD_RANGES[slot][0]);
}
/** Compatibility helper for drafts containing only a start time. Weekdays do not affect periods. */
export function slotForSchedule(date: string, startTime: string): PreferredSlot | null {
  const day = new Date(`${date}T12:00:00Z`);
  const start = clockMinutes(startTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== date || start === null) return null;
  return PREFERRED_SLOTS.find((slot) => start >= PERIOD_RANGES[slot][0] && start < PERIOD_RANGES[slot][1]) ?? null;
}
export function requestExpiresOn(preferredDate: string) { return preferredDate; }

export function slotsFromText(text: string): PreferredSlot[] {
  const patterns = [/上午|早上|\bmornings?\b/i, /下午|\bafternoons?\b/i, /晚上|晚间|\bevenings?\b|\bnights?\b/i];
  return PREFERRED_SLOTS.filter((_, index) => patterns[index].test(text));
}

/** "Have a court, need partners" always means the court is booked, whatever a draft says. */
export function withPartnerCourtBooked<T extends { requestKind?: string; venueBookingStatus?: string }>(form: T): T {
  return form.requestKind === 'find_partners' && form.venueBookingStatus !== 'booked'
    ? { ...form, venueBookingStatus: 'booked' }
    : form;
}
