import { createHmac } from 'node:crypto';

import type { Database } from './database';
import { getRuntimeEnv } from './runtime';

const WINDOW_MS = 15 * 60000;
/** Failures allowed for one username across all IPs within the window. */
export const MAX_FAILURES_PER_ACCOUNT = 5;
/** Failures allowed from one IP across all usernames within the window. */
export const MAX_FAILURES_PER_IP = 5;

export function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/** IPs are stored only as a keyed hash. */
export function hashIp(ip: string) {
  const secret = getRuntimeEnv().ADMIN_SESSION_SECRET || 'tennis-social-login';
  return createHmac('sha256', secret).update(ip).digest('base64url').slice(0, 32);
}

export async function isLoginLocked(db: Database, username: string, ipHash: string, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const rows = (await db`
    SELECT COUNT(*) FILTER (WHERE username = ${username} AND created_at > ${since})::integer AS account_failures,
           COUNT(*) FILTER (WHERE ip_hash = ${ipHash} AND created_at > ${since})::integer AS ip_failures,
           COALESCE(bool_or((username = ${username} AND account_locked_until > ${now.toISOString()})
             OR (ip_hash = ${ipHash} AND ip_locked_until > ${now.toISOString()})), false) AS locked
    FROM admin_login_attempts
    WHERE (username = ${username} OR ip_hash = ${ipHash}) AND NOT success AND (created_at > ${since} OR account_locked_until > ${now.toISOString()} OR ip_locked_until > ${now.toISOString()})
  `) as Array<{ account_failures: number; ip_failures: number; locked?: boolean }>;
  const row = rows[0];
  return Boolean(row && (row.locked || row.account_failures >= MAX_FAILURES_PER_ACCOUNT || row.ip_failures >= MAX_FAILURES_PER_IP));
}

export async function recordLoginAttempt(db: Database, username: string, ipHash: string, success: boolean, now = new Date()) {
  await db`
    INSERT INTO admin_login_attempts (id, username, ip_hash, success, created_at)
    VALUES (${`login-${crypto.randomUUID()}`}, ${username.slice(0, 120)}, ${ipHash}, ${success}, ${now.toISOString()})
  `;
}

/** Serialize the limit check and attempt insert, including simultaneous requests. */
export async function checkAndRecordLoginAttempt(db: Database, username: string, ipHash: string, success: boolean, now = new Date()) {
  const keys = [`admin-login-account:${username}`, `admin-login-ip:${ipHash}`].sort();
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const result = await db.transaction([
    db`SELECT pg_advisory_xact_lock(hashtextextended(${keys[0]}, 0))`,
    db`SELECT pg_advisory_xact_lock(hashtextextended(${keys[1]}, 0))`,
    db`
      WITH counts AS (
        SELECT COUNT(*) FILTER (WHERE username = ${username} AND created_at > ${since}) AS account_failures,
               COUNT(*) FILTER (WHERE ip_hash = ${ipHash} AND created_at > ${since}) AS ip_failures,
               COALESCE(bool_or((username = ${username} AND account_locked_until > ${now.toISOString()})
                 OR (ip_hash = ${ipHash} AND ip_locked_until > ${now.toISOString()})), false) AS active_lock
        FROM admin_login_attempts
        WHERE (username = ${username} OR ip_hash = ${ipHash})
          AND NOT success AND (created_at > ${since} OR account_locked_until > ${now.toISOString()} OR ip_locked_until > ${now.toISOString()})
      ), guard AS (
        SELECT *, active_lock OR account_failures >= ${MAX_FAILURES_PER_ACCOUNT} OR ip_failures >= ${MAX_FAILURES_PER_IP} AS locked FROM counts
      ), recorded AS (
        INSERT INTO admin_login_attempts (id, username, ip_hash, success, created_at, account_locked_until, ip_locked_until)
        SELECT ${`login-${crypto.randomUUID()}`}, ${username}, ${ipHash}, ${success}, ${now.toISOString()},
          CASE WHEN NOT ${success} AND account_failures + 1 >= ${MAX_FAILURES_PER_ACCOUNT} THEN ${new Date(now.getTime() + WINDOW_MS).toISOString()} ELSE NULL END,
          CASE WHEN NOT ${success} AND ip_failures + 1 >= ${MAX_FAILURES_PER_IP} THEN ${new Date(now.getTime() + WINDOW_MS).toISOString()} ELSE NULL END
        FROM guard WHERE NOT locked RETURNING id
      ) SELECT locked FROM guard
    `,
  ]);
  return Boolean((result[2] as Array<{ locked: boolean }>)[0]?.locked);
}
