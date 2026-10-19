import { createHmac } from 'node:crypto';

import type { Database } from './database';
import { getRuntimeEnv } from './runtime';

const WINDOW_MS = 15 * 60000;
/** Failures allowed for one username from one IP within the window. */
export const MAX_FAILURES_PER_ACCOUNT = 5;
/** Failures allowed from one IP across all usernames within the window. */
export const MAX_FAILURES_PER_IP = 20;

export function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/** IPs are stored only as a keyed hash. */
export function hashIp(ip: string) {
  const secret = getRuntimeEnv().ADMIN_SESSION_SECRET || 'tennis-social-login';
  return createHmac('sha256', secret).update(ip).digest('base64url').slice(0, 32);
}

/**
 * Locked when this IP has failed too often for this username, or too often
 * overall. Locking per IP (not per username) stops a stranger from locking the
 * real admin out from another network.
 */
export async function isLoginLocked(db: Database, username: string, ipHash: string, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const rows = (await db`
    SELECT COUNT(*) FILTER (WHERE username = ${username})::integer AS account_failures,
           COUNT(*)::integer AS ip_failures
    FROM admin_login_attempts
    WHERE ip_hash = ${ipHash} AND NOT success AND created_at > ${since}
  `) as Array<{ account_failures: number; ip_failures: number }>;
  const row = rows[0];
  return Boolean(row && (row.account_failures >= MAX_FAILURES_PER_ACCOUNT || row.ip_failures >= MAX_FAILURES_PER_IP));
}

export async function recordLoginAttempt(db: Database, username: string, ipHash: string, success: boolean, now = new Date()) {
  await db`
    INSERT INTO admin_login_attempts (id, username, ip_hash, success, created_at)
    VALUES (${`login-${crypto.randomUUID()}`}, ${username.slice(0, 120)}, ${ipHash}, ${success}, ${now.toISOString()})
  `;
}
