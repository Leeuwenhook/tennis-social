import { createHmac, timingSafeEqual } from 'node:crypto';

import { getRuntimeEnv } from './runtime';

export const ADMIN_COOKIE_NAME = 'tennis-social-admin-session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin1234';

type AdminAccount = {
  username: string;
  password: string;
};

function adminConfig() {
  const env = getRuntimeEnv();
  if (
    process.env.NODE_ENV === 'production' &&
    (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET)
  )
    return null;
  const accounts: AdminAccount[] = [
    {
      username: env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME,
      password: env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    },
  ];
  const secondUsername = env.ADMIN_USERNAME_2?.trim() || '';
  const secondPassword = env.ADMIN_PASSWORD_2 || '';
  const hasSecondAccountConfig = Boolean(secondUsername || secondPassword);
  if (hasSecondAccountConfig && (!secondUsername || !secondPassword)) return null;
  if (secondUsername && secondPassword) {
    accounts.push({ username: secondUsername, password: secondPassword });
  }
  const secret =
    env.ADMIN_SESSION_SECRET ||
    `tennis-social:${accounts.map(({ username, password }) => `${username}:${password}`).join('|')}`;
  return { accounts, secret };
}

function encode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signature(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function equal(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function readCookie(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === ADMIN_COOKIE_NAME) return value.join('=');
  }
  return '';
}

export function areAdminCredentialsValid(username: string, password: string) {
  const config = adminConfig();
  if (!config) return false;
  return config.accounts.some(
    (account) => equal(username, account.username) && equal(password, account.password),
  );
}

export function createAdminSession(username: string) {
  const config = adminConfig();
  if (!config) throw new Error('admin_auth_not_configured');
  const payload = encode(
    JSON.stringify({
      sub: username,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
  );
  return `${payload}.${signature(payload, config.secret)}`;
}

export function isAdminAuthenticated(request: Request) {
  const value = readCookie(request);
  const [payload, providedSignature] = value.split('.');
  if (!payload || !providedSignature) return false;
  const config = adminConfig();
  if (!config) return false;
  if (!equal(providedSignature, signature(payload, config.secret)))
    return false;
  try {
    const parsed = JSON.parse(decode(payload)) as {
      sub?: unknown;
      exp?: unknown;
    };
    return (
      typeof parsed.sub === 'string' &&
      config.accounts.some((account) => parsed.sub === account.username) &&
      typeof parsed.exp === 'number' &&
      parsed.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export function requireAdmin(request: Request) {
  return isAdminAuthenticated(request)
    ? null
    : Response.json({ error: 'admin_unauthorized' }, { status: 401 });
}

function cookieAttributes(maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function adminSessionCookie(session: string) {
  return `${ADMIN_COOKIE_NAME}=${session}; ${cookieAttributes(SESSION_TTL_SECONDS)}`;
}

export function clearAdminSessionCookie() {
  return `${ADMIN_COOKIE_NAME}=; ${cookieAttributes(0)}`;
}
