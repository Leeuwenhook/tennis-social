import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { verifyToken } from '@/lib/server/signed-token';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const payload = verifyToken('unsubscribe', token);
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!payload || !/^\S+@\S+\.\S+$/.test(email)) return new Response('Invalid or expired link. / 链接无效或已过期。', { status: 400, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  try {
    const db = database();
    await db`INSERT INTO email_suppressions (email, created_at) VALUES (${email}, ${new Date().toISOString()}) ON CONFLICT (email) DO NOTHING`;
    return new Response('You have unsubscribed from post-session emails. Booking confirmations and reminders are unaffected. / 已退订赛后邮件，预订确认和赛前提醒不受影响。', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    if (!(error instanceof DatabaseNotConfiguredError)) console.error('Unable to save email suppression');
    return new Response('Please try again later. / 请稍后重试。', { status: 503, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
}
