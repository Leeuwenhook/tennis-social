import { getRuntimeEnv } from './runtime';
import type { GameFormat } from '../demo-data';

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  payment_intent: string | null;
  metadata?: Record<string, string>;
};

async function stripeRequest<T>(path: string, init: RequestInit = {}, idempotencyKey?: string): Promise<T> {
  const secret = getRuntimeEnv().STRIPE_SECRET_KEY;
  if (!secret) throw new Error('stripe_not_configured');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${secret}`);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
  const response = await fetch(`https://api.stripe.com/v1${path}`, { ...init, headers });
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `stripe_${response.status}`);
  return body;
}

export async function createCheckoutSession(input: {
  bookingId: string;
  sessionId: string;
  format: GameFormat;
  venueName: string;
  participantCount: number;
  sessionPricePence: number;
  racketCount: number;
  racketPricePence: number;
  email: string;
  origin: string;
  expiresAtSeconds: number;
}) {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('payment_method_types[]', 'card');
  params.set('customer_email', input.email);
  params.set('client_reference_id', input.bookingId);
  params.set('metadata[booking_id]', input.bookingId);
  params.set('metadata[session_id]', input.sessionId);
  params.set('metadata[format]', input.format);
  params.set('payment_intent_data[metadata][booking_id]', input.bookingId);
  params.set('payment_intent_data[metadata][format]', input.format);
  params.set('expires_at', String(input.expiresAtSeconds));
  params.set('success_url', `${input.origin}/?checkout=success&booking_id=${encodeURIComponent(input.bookingId)}&checkout_session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${input.origin}/?checkout=cancelled&booking_id=${encodeURIComponent(input.bookingId)}`);
  params.set('line_items[0][price_data][currency]', 'gbp');
  params.set('line_items[0][price_data][unit_amount]', String(input.sessionPricePence));
  params.set('line_items[0][price_data][product_data][name]', `${input.venueName} ${input.format} tennis session`);
  params.set('line_items[0][quantity]', String(input.participantCount));
  if (input.racketCount > 0) {
    params.set('line_items[1][price_data][currency]', 'gbp');
    params.set('line_items[1][price_data][unit_amount]', String(input.racketPricePence));
    params.set('line_items[1][price_data][product_data][name]', 'Racket rental');
    params.set('line_items[1][quantity]', String(input.racketCount));
  }
  return stripeRequest<StripeCheckoutSession>('/checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  }, `checkout-${input.bookingId}`);
}

export function retrieveCheckoutSession(id: string) {
  return stripeRequest<StripeCheckoutSession>(`/checkout/sessions/${encodeURIComponent(id)}`);
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyStripeWebhook(payload: string, signatureHeader: string | null) {
  const secret = getRuntimeEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const pieces = signatureHeader.split(',').map((part) => part.split('=', 2));
  const timestamp = pieces.find(([key]) => key === 't')?.[1];
  const signatures = pieces.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some((signature) => safeEqual(digest, signature));
}
