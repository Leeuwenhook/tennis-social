import type { Metadata } from 'next';
import { venues } from '@/lib/demo-data';
import type { BookingRow } from '@/lib/server/database';
import {
  renderBookingConfirmationEmail,
  renderBookingReminderEmail,
} from '@/lib/server/email';

export const metadata: Metadata = {
  title: 'Email previews | Tennis Social',
  description: 'Preview the booking confirmation and session reminder emails.',
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const londonDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function tomorrowInLondon() {
  const parts = Object.fromEntries(londonDate.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

const date = tomorrowInLondon();
const booking: BookingRow = {
  id: 'TS-8E2C-417A',
  session_id: 'session-victoria-midweek',
  user_id: null,
  contact_name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  phone: '',
  participants_json: '["3.5","3.0"]',
  format: 'doubles',
  participant_count: 2,
  racket_count: 1,
  session_price_pence: 1000,
  racket_price_pence: 200,
  coupon_id: null,
  coupon_discount_pence: 0,
  loyalty_discount_percent: 0,
  loyalty_discount_pence: 0,
  total_pence: 2200,
  status: 'confirmed',
  stripe_checkout_session_id: 'cs_preview',
  stripe_payment_intent_id: 'pi_preview',
  checkout_url: null,
  expires_at: null,
  confirmation_email_status: 'sent',
  confirmation_email_sent_at: new Date().toISOString(),
  confirmation_email_message_id: 'preview-confirmation',
  confirmation_email_claimed_at: null,
  reminder_email_status: 'pending',
  reminder_email_sent_at: null,
  reminder_email_message_id: null,
  reminder_email_claimed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const session = {
  date,
  start_time: '18:30',
  end_time: '20:30',
  description: 'A relaxed midweek hit with rotating doubles and friendly match play.',
  description_zh: '轻松的工作日晚间约球，轮换双打并穿插友谊赛。',
};
const venue = venues.find((item) => item.id === 'victoria-park') ?? venues[0];
const emails = [
  {
    id: 'confirmation',
    eyebrow: 'After successful payment',
    title: '预订成功确认邮件',
    timing: '用户付款成功后立即发送',
    email: renderBookingConfirmationEmail({ booking, session, venue }),
    to: booking.email,
  },
  {
    id: 'reminder',
    eyebrow: 'The evening before the session',
    title: '前一天晚上 6 点提醒邮件',
    timing: '活动前一天，伦敦时间 18:00 发送',
    email: renderBookingReminderEmail({ booking, session, venue }),
    to: booking.email,
  },
];

export default function EmailPreviewPage() {
  return (
    <main style={{ minHeight: '100vh', padding: '40px 18px 72px', background: '#edf2eb', color: '#173b2f', fontFamily: 'Arial,Helvetica,sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <p style={{ margin: '0 0 8px', color: '#557064', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }}>Tennis Social · Email design preview</p>
        <h1 style={{ margin: '0 0 10px', fontSize: 32 }}>两封预订邮件预览</h1>
        <p style={{ margin: '0 0 28px', color: '#557064', lineHeight: 1.6 }}>使用同一笔示例预订，展示付款成功确认邮件和活动前一晚提醒邮件。收件地址为演示地址，不会真的发送。</p>
        <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 30 }}>
          {emails.map((item) => <a key={item.id} href={`#${item.id}`} style={{ padding: '10px 14px', borderRadius: 8, background: '#173b2f', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>{item.title}</a>)}
        </nav>
        <div style={{ display: 'grid', gap: 36 }}>
          {emails.map((item) => (
            <section key={item.id} id={item.id} style={{ scrollMarginTop: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 4px', color: '#557064', fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>{item.eyebrow}</p>
                <h2 style={{ margin: '0 0 4px', fontSize: 23 }}>{item.title}</h2>
                <p style={{ margin: 0, color: '#557064' }}>{item.timing}</p>
              </div>
              <div style={{ padding: '14px 18px', border: '1px solid #dce8dc', borderBottom: 0, borderRadius: '12px 12px 0 0', background: '#fff', fontSize: 13, lineHeight: 1.8 }}>
                <div><strong>To:</strong> {item.to}</div>
                <div><strong>Subject:</strong> {item.email.subject}</div>
              </div>
              <div dangerouslySetInnerHTML={{ __html: item.email.html }} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
