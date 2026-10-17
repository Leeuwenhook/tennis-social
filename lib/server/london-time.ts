const londonFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function londonDateTime(now: Date) {
  return Object.fromEntries(londonFormatter.formatToParts(now).map((part) => [part.type, part.value]));
}
export function londonDate(now: Date) {
  const parts = londonDateTime(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Choose the later instant in the repeated autumn hour; never send too early. */
export function londonSessionEnd(date: string, endTime: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(endTime)) return null;
  const base = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 10) !== date) return null;
  const [hour, minute] = endTime.split(':').map(Number);
  const wallTime = base + (hour * 60 + minute) * 60000;
  const normalized = new Date(wallTime).toISOString().slice(0, 16);
  const candidates = [wallTime, wallTime - 3600000];
  return candidates.find((instant) => {
    const parts = londonDateTime(new Date(instant));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === normalized;
  }) ?? null;
}
