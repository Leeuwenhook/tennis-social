import { database, DatabaseNotConfiguredError } from '@/lib/server/database';
import { verifyToken } from '@/lib/server/signed-token';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const baseHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};

function tokenEmail(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const payload = verifyToken('unsubscribe', token);
  const email =
    typeof payload?.email === 'string'
      ? payload.email.trim().toLowerCase()
      : '';
  return payload && /^\S+@\S+\.\S+$/.test(email) ? { token, email } : null;
}

function invalidLink() {
  return new Response('Invalid or expired link. / 链接无效或已过期。', {
    status: 400,
    headers: baseHeaders,
  });
}

function escapeAttribute(value: string) {
  return value.replace(/[&"<>]/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * Only shows a confirmation form: mail scanners and link previews fetch GET
 * URLs automatically, so the suppression itself requires a POST.
 */
export function GET(request: Request) {
  const valid = tokenEmail(request);
  if (!valid) return invalidLink();
  const action = `/api/email/unsubscribe?t=${encodeURIComponent(valid.token)}`;
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Unsubscribe / 退订</title></head><body style="font-family:Arial,sans-serif;max-width:560px;margin:48px auto;padding:0 18px;color:#173b2f"><h1>Unsubscribe from post-session emails? / 退订赛后邮件？</h1><p>Booking confirmations and reminders are unaffected. / 预订确认和赛前提醒不受影响。</p><form method="post" action="${escapeAttribute(action)}"><button type="submit" style="padding:10px 16px">Unsubscribe / 确认退订</button></form></body></html>`,
    {
      headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    },
  );
}

/** Handles the confirmation form and RFC 8058 one-click (List-Unsubscribe-Post) requests. */
export async function POST(request: Request) {
  const valid = tokenEmail(request);
  if (!valid) return invalidLink();
  try {
    const db = database();
    await db`INSERT INTO email_suppressions (email, created_at) VALUES (${valid.email}, ${new Date().toISOString()}) ON CONFLICT (email) DO NOTHING`;
    return new Response(
      'You have unsubscribed from post-session emails. Booking confirmations and reminders are unaffected. / 已退订赛后邮件，预订确认和赛前提醒不受影响。',
      {
        headers: {
          ...baseHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
        },
      },
    );
  } catch (error) {
    if (!(error instanceof DatabaseNotConfiguredError))
      console.error('Unable to save email suppression');
    return new Response('Please try again later. / 请稍后重试。', {
      status: 503,
      headers: baseHeaders,
    });
  }
}
