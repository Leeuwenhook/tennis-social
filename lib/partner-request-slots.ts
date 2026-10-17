export const PREFERRED_SLOTS = [
  'weekday_morning',
  'weekday_afternoon',
  'weekday_evening',
  'weekend_any',
] as const;
export type PreferredSlot = (typeof PREFERRED_SLOTS)[number];
export const SLOT_REQUEST_TTL_DAYS = 30;
export const SLOT_LABELS = {
  en: {
    weekday_morning: 'Weekday mornings',
    weekday_afternoon: 'Weekday afternoons',
    weekday_evening: 'Weekday evenings',
    weekend_any: 'Any time at weekends',
  },
  zh: {
    weekday_morning: '工作日上午',
    weekday_afternoon: '工作日下午',
    weekday_evening: '工作日晚上',
    weekend_any: '周末任意',
  },
};
export function slotLabels(
  slots: readonly string[] = [],
  language: 'en' | 'zh',
) {
  return PREFERRED_SLOTS.filter((slot) => slots.includes(slot))
    .map((slot) => SLOT_LABELS[language][slot])
    .join(' · ');
}
export function requestExpiresOn(
  preferredDate: string | null,
  now = new Date(),
) {
  return (
    preferredDate ||
    new Date(now.getTime() + SLOT_REQUEST_TTL_DAYS * 86400000)
      .toISOString()
      .slice(0, 10)
  );
}
