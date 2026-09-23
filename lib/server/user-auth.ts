import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { database, type Database } from './database';

const scrypt = promisify(scryptCallback);

export const USER_COOKIE_NAME = 'tennis-social-user-session';
export const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const TENNIS_LEVELS = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'] as const;
export const PREFERRED_TIMES = ['weekends', 'weekday_evenings', 'anytime', 'mornings', 'afternoons'] as const;
export const PREFERRED_FORMATS = ['singles', 'doubles'] as const;

export type UserProfileInput = {
  name: string;
  email: string;
  phone: string;
  postcode: string;
  tennisLevel: typeof TENNIS_LEVELS[number];
  preferredTime: typeof PREFERRED_TIMES[number];
  preferredFormat: typeof PREFERRED_FORMATS[number];
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  tennisLevel: string;
  preferredTime: typeof PREFERRED_TIMES[number];
  preferredFormat: typeof PREFERRED_FORMATS[number];
};

function clean(value: unknown, length: number) {
  return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

export function normalizeUserProfileInput(input: Record<string, unknown>): UserProfileInput | null {
  if (!input || typeof input !== 'object') return null;
  const name = clean(input.name, 120);
  const email = clean(input.email, 254).toLowerCase();
  const phone = clean(input.phone, 40);
  const postcode = clean(input.postcode, 12).toUpperCase().replace(/\s+/g, ' ');
  const tennisLevel = clean(input.tennisLevel, 8);
  const preferredTime = clean(input.preferredTime, 30);
  const preferredFormat = clean(input.preferredFormat, 20);
  if (
    !name || !/^\S+@\S+\.\S+$/.test(email) ||
    !/^[A-Z0-9 ]{2,12}$/.test(postcode) || !TENNIS_LEVELS.includes(tennisLevel as never) ||
    !PREFERRED_TIMES.includes(preferredTime as never) || !PREFERRED_FORMATS.includes(preferredFormat as never)
  ) return null;
  return {
    name,
    email,
    phone,
    postcode,
    tennisLevel: tennisLevel as UserProfileInput['tennisLevel'],
    preferredTime: preferredTime as UserProfileInput['preferredTime'],
    preferredFormat: preferredFormat as UserProfileInput['preferredFormat'],
  };
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  postcode: string;
  tennis_level: string;
  preferred_time: typeof PREFERRED_TIMES[number];
  preferred_format: typeof PREFERRED_FORMATS[number];
};

function readCookie(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === USER_COOKIE_NAME) return value.join('=');
  }
  return '';
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltValue, hashValue] = stored.split(':');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, 'base64url');
    const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function serializeUser(row: UserRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    postcode: row.postcode,
    tennisLevel: row.tennis_level,
    preferredTime: row.preferred_time,
    preferredFormat: row.preferred_format,
  };
}

export async function createUserSession(db: Database, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + USER_SESSION_TTL_SECONDS * 1000).toISOString();
  await db.transaction([
    db`DELETE FROM user_sessions WHERE expires_at <= ${now.toISOString()}`,
    db`INSERT INTO user_sessions (token_hash, user_id, expires_at, created_at)
       VALUES (${tokenHash(token)}, ${userId}, ${expiresAt}, ${now.toISOString()})`,
  ]);
  return token;
}

export async function getAuthenticatedUser(request: Request, db = database()) {
  const token = readCookie(request);
  if (!token) return null;
  const rows = await db`
    SELECT users.id, users.name, users.email, users.phone, users.password_hash,
           users.postcode, users.tennis_level, users.preferred_time, users.preferred_format
    FROM user_sessions
    INNER JOIN users ON users.id = user_sessions.user_id
    WHERE user_sessions.token_hash = ${tokenHash(token)}
      AND user_sessions.expires_at > ${new Date().toISOString()}
    LIMIT 1
  ` as UserRow[];
  return rows[0] ?? null;
}

export async function deleteUserSession(request: Request, db = database()) {
  const token = readCookie(request);
  if (token) await db`DELETE FROM user_sessions WHERE token_hash = ${tokenHash(token)}`;
}

function cookieAttributes(maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function userSessionCookie(token: string) {
  return `${USER_COOKIE_NAME}=${token}; ${cookieAttributes(USER_SESSION_TTL_SECONDS)}`;
}

export function clearUserSessionCookie() {
  return `${USER_COOKIE_NAME}=; ${cookieAttributes(0)}`;
}
