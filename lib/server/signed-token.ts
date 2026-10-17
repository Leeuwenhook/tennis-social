import { createHmac, timingSafeEqual } from 'node:crypto';
import { getRuntimeEnv } from './runtime';

type Purpose = 'review' | 'unsubscribe';
type Payload = Record<string, string | number>;

function secret() {
  const value = getRuntimeEnv().REVIEW_TOKEN_SECRET;
  if (!value || Buffer.byteLength(value) < 32) throw new Error('token_secret_not_configured');
  return value;
}

export function signToken(purpose: Purpose, payload: Payload, ttlSeconds: number, now = new Date()) {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) throw new Error('invalid_token_ttl');
  const body = Buffer.from(JSON.stringify({ ...payload, p: purpose, exp: Math.floor(now.getTime() / 1000) + ttlSeconds })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(`${purpose}.${body}`).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyToken(purpose: Purpose, token: string, now = new Date()): Payload | null {
  try {
    if (token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
    const [body, signature] = parts;
    const expected = createHmac('sha256', secret()).update(`${purpose}.${body}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const value: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const payload = value as Payload;
    if (payload.p !== purpose || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(now.getTime() / 1000) || !Object.values(payload).every((item) => typeof item === 'string' || typeof item === 'number')) return null;
    return payload;
  } catch { return null; }
}
