/** Opaque position, never interpolated into SQL. Invalid cursors are ignored. */
export function readAdminCursor(value: string | null): Record<string, string> | null {
  if (!value || value.length > 2048) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (!['id', 'created'].every((key) => typeof record[key] === 'string' && record[key].length <= 200)) return null;
    if (['date', 'start'].some((key) => key in record && typeof record[key] !== 'string')) return null;
    return record as Record<string, string>;
  } catch { return null; }
}
export function adminCursor(value: Record<string, string>) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
