import type { BookingRow, SessionRow } from './database';
import { getRuntimeEnv } from './runtime';
import nodemailer from 'nodemailer';
import { resolveVenueDescriptions } from '../venue-description';
import type { Venue } from '../demo-data';

const LONDON_TIME_ZONE = 'Europe/London';

export type BookingEmailInput = {
  booking: BookingRow;
  session: Pick<
    SessionRow,
    'date' | 'start_time' | 'end_time'
  >;
  venue: Venue;
};

export type EmailSendResult = {
  status: 'sent' | 'skipped';
  messageId?: string;
};

export type RenderedBookingEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

function foldIcsLines(value: string) {
  return value
    .split('\r\n')
    .map((line) => {
      const chunks: string[] = [];
      let current = '';
      for (const character of line) {
        if (current.length >= 73) {
          chunks.push(current);
          current = ` ${character}`;
        } else {
          current += character;
        }
      }
      chunks.push(current);
      return chunks.join('\r\n');
    })
    .join('\r\n');
}

function localIcsDate(date: string, time: string) {
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');
  return `${year}${month}${day}T${hour}${minute}00`;
}

function utcIcsDate(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    dateStyle: 'full',
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function formatFormat(format: BookingRow['format']) {
  return format === 'doubles' ? 'Doubles' : 'Singles';
}

function parseParticipants(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
      ? (parsed as string[])
      : [];
  } catch {
    return [];
  }
}

export function createBookingCalendar(
  input: BookingEmailInput,
  now = new Date(),
) {
  const { booking, session, venue } = input;
  const participants = parseParticipants(booking.participants_json);
  const venueAddress = [venue.name, venue.address || venue.area, venue.postcode]
    .filter(Boolean)
    .join(', ');
  const description = [
    `Booking reference: ${booking.id}`,
    `Location: ${venueAddress}`,
    `Format: ${formatFormat(booking.format)}`,
    `Participants: ${participants.length}`,
    `Rackets: ${booking.racket_count}`,
    `Activity: ${resolveVenueDescriptions(venue).description}`,
  ].join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tennis Match//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(booking.id)}@tennis-social`,
    `DTSTAMP:${utcIcsDate(now)}`,
    `DTSTART;TZID=${LONDON_TIME_ZONE}:${localIcsDate(session.date, session.start_time)}`,
    `DTEND;TZID=${LONDON_TIME_ZONE}:${localIcsDate(session.date, session.end_time)}`,
    `SUMMARY:${escapeIcs(`Tennis Match: ${venue.name}`)}`,
    `LOCATION:${escapeIcs(venueAddress)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  return foldIcsLines(lines.join('\r\n'));
}

export function renderBookingConfirmationEmail(input: BookingEmailInput): RenderedBookingEmail {
  const { booking, session, venue } = input;
  const participants = parseParticipants(booking.participants_json);
  const date = formatLongDate(session.date);
  const time = `${session.start_time}–${session.end_time} (${LONDON_TIME_ZONE})`;
  const format = formatFormat(booking.format);
  const activityDescription = resolveVenueDescriptions(venue).description;
  const discountRows = [
    booking.loyalty_discount_pence > 0
      ? `<tr><td style="padding:8px 0;color:#557064">Permanent 10% member discount</td><td style="padding:8px 0;font-weight:700;color:#2f7b52">−${formatMoney(booking.loyalty_discount_pence)}</td></tr>`
      : '',
    booking.coupon_discount_pence > 0
      ? `<tr><td style="padding:8px 0;color:#557064">Half-price voucher</td><td style="padding:8px 0;font-weight:700;color:#2f7b52">−${formatMoney(booking.coupon_discount_pence)}</td></tr>`
      : '',
  ].join('');
  const participantRows = participants.length
    ? participants
        .map(
          (level, index) =>
            `<li>Participant ${index + 1}: ${escapeHtml(level)}</li>`,
        )
        .join('')
    : '<li>See your booking record</li>';
  const html = `
    <div style="background:#f4f7f2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#173b2f;line-height:1.6">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8dc;border-radius:16px;overflow:hidden">
        <div style="padding:28px 32px;background:#173b2f;color:#ffffff">
          <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#d5eb85">Tennis Match</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Booking confirmed</h1>
        </div>
        <div style="padding:28px 32px">
          <p>Hi ${escapeHtml(booking.contact_name)}, your payment was successful and your place is confirmed.</p>
          <div style="margin:24px 0;padding:18px 20px;background:#f4f7f2;border-radius:12px">
            <div style="font-size:12px;color:#557064;text-transform:uppercase;letter-spacing:1px">Booking reference</div>
            <div style="font-size:22px;font-weight:700;margin-top:4px">${escapeHtml(booking.id)}</div>
          </div>
          <h2 style="font-size:18px;margin:24px 0 10px">Activity details</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#557064;width:42%">Location</td><td style="padding:8px 0;font-weight:700">${escapeHtml(`${venue.name} · ${venue.area}`)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Date</td><td style="padding:8px 0;font-weight:700">${escapeHtml(date)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Time</td><td style="padding:8px 0;font-weight:700">${escapeHtml(time)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Format</td><td style="padding:8px 0;font-weight:700">${escapeHtml(format)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Participants</td><td style="padding:8px 0;font-weight:700">${participants.length}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Rackets</td><td style="padding:8px 0;font-weight:700">${booking.racket_count}</td></tr>
            ${discountRows}
            <tr><td style="padding:8px 0;color:#557064">Total paid</td><td style="padding:8px 0;font-weight:700">${formatMoney(booking.total_pence)}</td></tr>
          </table>
          <p style="margin:20px 0 8px;font-weight:700">Activity</p>
          <p style="margin:0;color:#557064">${escapeHtml(activityDescription)}</p>
          <p style="margin:20px 0 8px;font-weight:700">Levels</p>
          <ul style="margin:0;padding-left:22px;color:#557064">${participantRows}</ul>
          <div style="margin-top:26px;padding:16px 18px;border:1px solid #dce8dc;border-radius:12px">
            <strong>Calendar invite attached</strong>
            <div style="color:#557064;margin-top:4px">Open the attached .ics file to add this activity to Google Calendar, Apple Calendar or Outlook.</div>
          </div>
          <p style="margin:24px 0 0;color:#557064;font-size:13px">Please keep this email for your booking details. See you on court!</p>
        </div>
      </div>
    </div>
  `;
  const text = [
    'Tennis Match — Booking confirmed',
    '',
    `Hi ${booking.contact_name}, your payment was successful and your place is confirmed.`,
    '',
    `Booking reference: ${booking.id}`,
    `Location: ${venue.name} · ${venue.area}`,
    `Date: ${date}`,
    `Time: ${time}`,
    `Format: ${format}`,
    `Participants: ${participants.length}`,
    `Rackets: ${booking.racket_count}`,
    ...(booking.loyalty_discount_pence > 0 ? [`Permanent 10% member discount: -${formatMoney(booking.loyalty_discount_pence)}`] : []),
    ...(booking.coupon_discount_pence > 0 ? [`Half-price voucher: -${formatMoney(booking.coupon_discount_pence)}`] : []),
    `Total paid: ${formatMoney(booking.total_pence)}`,
    `Activity: ${activityDescription}`,
    `Levels: ${participants.join(', ') || '—'}`,
    '',
    'A .ics calendar invite is attached.',
  ].join('\n');
  return {
    html,
    text,
    subject: `Booking confirmed · ${venue.name} · ${session.date}`,
  };
}

export function renderBookingReminderEmail(input: BookingEmailInput): RenderedBookingEmail {
  const { booking, session, venue } = input;
  const date = formatLongDate(session.date);
  const time = `${session.start_time}–${session.end_time} (${LONDON_TIME_ZONE})`;
  const format = formatFormat(booking.format);
  const html = `
    <div style="background:#f4f7f2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#173b2f;line-height:1.6">
      <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">Your Tennis Match session is tomorrow.</span>
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8dc;border-radius:16px;overflow:hidden">
        <div style="padding:28px 32px;background:#173b2f;color:#ffffff">
          <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#d5eb85">Tennis Match</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Your session is tomorrow</h1>
        </div>
        <div style="padding:28px 32px">
          <p>Hi ${escapeHtml(booking.contact_name)}, a quick reminder that your tennis session is tomorrow.</p>
          <div style="margin:24px 0;padding:18px 20px;background:#f4f7f2;border-radius:12px">
            <div style="font-size:12px;color:#557064;text-transform:uppercase;letter-spacing:1px">Tomorrow</div>
            <div style="font-size:22px;font-weight:700;margin-top:4px">${escapeHtml(date)}</div>
            <div style="font-size:18px;font-weight:700;margin-top:2px">${escapeHtml(time)}</div>
          </div>
          <h2 style="font-size:18px;margin:24px 0 10px">Session details</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#557064;width:42%">Location</td><td style="padding:8px 0;font-weight:700">${escapeHtml(`${venue.name} · ${venue.area}`)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Format</td><td style="padding:8px 0;font-weight:700">${escapeHtml(format)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Participants</td><td style="padding:8px 0;font-weight:700">${booking.participant_count}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Booking reference</td><td style="padding:8px 0;font-weight:700">${escapeHtml(booking.id)}</td></tr>
          </table>
          <p style="margin:24px 0 0;color:#557064">We look forward to seeing you on court.</p>
        </div>
      </div>
    </div>
  `;
  const text = [
    'Tennis Match — Your session is tomorrow',
    '',
    `Hi ${booking.contact_name}, a quick reminder that your tennis session is tomorrow.`,
    '',
    `Date: ${date}`,
    `Time: ${time}`,
    `Location: ${venue.name} · ${venue.area}`,
    `Format: ${format}`,
    `Participants: ${booking.participant_count}`,
    `Booking reference: ${booking.id}`,
    '',
    'We look forward to seeing you on court.',
  ].join('\n');
  return {
    subject: `Reminder: your tennis session is tomorrow · ${venue.name}`,
    html,
    text,
  };
}

export function isEmailConfigured() {
  const { SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = getRuntimeEnv();
  return Boolean(SMTP_USER && SMTP_PASSWORD && EMAIL_FROM);
}

function smtpTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = getRuntimeEnv();
  if (!SMTP_USER || !SMTP_PASSWORD) return null;
  const port = Number(SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.hostinger.com',
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === 'true' : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

export async function sendBookingConfirmationEmail(
  input: BookingEmailInput,
): Promise<EmailSendResult> {
  const { EMAIL_FROM } = getRuntimeEnv();
  const transport = smtpTransport();
  if (!transport || !EMAIL_FROM) return { status: 'skipped' };

  const email = renderBookingConfirmationEmail(input);
  const calendar = createBookingCalendar(input);
  const result = await transport.sendMail({
    from: EMAIL_FROM,
    to: input.booking.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: [{ filename: 'tennis-social-booking.ics', content: calendar }],
  });
  return { status: 'sent', messageId: result.messageId };
}

export async function sendBookingReminderEmail(
  input: BookingEmailInput,
): Promise<EmailSendResult> {
  const { EMAIL_FROM } = getRuntimeEnv();
  const transport = smtpTransport();
  if (!transport || !EMAIL_FROM) return { status: 'skipped' };

  const email = renderBookingReminderEmail(input);
  const result = await transport.sendMail({
    from: EMAIL_FROM,
    to: input.booking.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  return { status: 'sent', messageId: result.messageId };
}

export function adminNotifyRecipients(value = getRuntimeEnv().ADMIN_NOTIFY_EMAIL): string[] {
  return [...new Set((value?.trim() || 'una.ge2502@gmail.com,leeuwenhook.sun@gmail.com').split(',').map((item) => item.trim().toLowerCase()).filter((item) => /^\S+@\S+\.\S+$/.test(item)))];
}

function renderAdminDetails(subject: string, details: Record<string, unknown>): RenderedBookingEmail {
  const text = Object.entries(details).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value ?? '')}`).join('\n');
  return { subject, text: `${text}\nhttps://www.tennismatch.space/admin`, html: `<h1>${escapeHtml(subject)}</h1><pre>${escapeHtml(text)}</pre><a href="https://www.tennismatch.space/admin">Admin / 后台</a>` };
}

export function renderAdminBookingNotificationEmail({ booking: b, session: s, venue }: BookingEmailInput) {
  return renderAdminDetails(`新报名：${venue.nameZh || venue.name} ${s.date} ${s.start_time}–${s.end_time} · ${b.participant_count}人`, {
    Reference: b.id, Name: b.contact_name, Email: b.email, Phone: b.phone,
    Format: b.format, Participants: b.participants_json, Rackets: b.racket_count,
    Total: formatMoney(b.total_pence), Coupon: formatMoney(b.coupon_discount_pence), Loyalty: formatMoney(b.loyalty_discount_pence),
  });
}

export function renderAdminRequestNotificationEmail(kind: 'request' | 'application', details: Record<string, unknown>) {
  return renderAdminDetails(kind === 'request' ? '新找球友 / 订场需求 · New partner request' : '新加入申请 · New application', details);
}

async function sendAdminEmail(email: RenderedBookingEmail): Promise<EmailSendResult> {
  const to = adminNotifyRecipients();
  if (!to.length) { console.info('Admin notification skipped: no valid admin recipients.'); return { status: 'skipped' }; }
  const transport = smtpTransport();
  const { EMAIL_FROM } = getRuntimeEnv();
  if (!transport || !EMAIL_FROM) return { status: 'skipped' };
  const result = await transport.sendMail({ from: EMAIL_FROM, to, ...email });
  return { status: 'sent', messageId: result.messageId };
}

export function sendAdminBookingNotification(input: BookingEmailInput) {
  return sendAdminEmail(renderAdminBookingNotificationEmail(input));
}

export async function sendAdminRequestNotification(kind: 'request' | 'application', details: Record<string, unknown>) {
  try { return await sendAdminEmail(renderAdminRequestNotificationEmail(kind, details)); }
  catch { console.error('Admin request notification failed', details.id); return { status: 'skipped' as const }; }
}

export type BookingFollowupInput = BookingEmailInput & {
  reviewUrl?: string;
  unsubscribeUrl: string;
  nextSessions: Array<{ id: string; date: string; start_time: string; end_time: string; name: string; name_zh: string }>;
};
export function renderBookingFollowupEmail(input: BookingFollowupInput): RenderedBookingEmail {
  const { booking, session, venue, reviewUrl, unsubscribeUrl } = input;
  const thanks = `Thanks for playing, ${booking.contact_name}! / 感谢参加网球活动！`;
  const details = `${venue.name} / ${venue.nameZh} · ${session.date} ${session.start_time}–${session.end_time}`;
  const next = input.nextSessions.slice(0, 3).map((item) => ({ ...item, url: `https://www.tennismatch.space/?view=detail&session=${encodeURIComponent(item.id)}` }));
  const text = [thanks, details, 'We hope to see you on court again. / 期待下次在球场相见。',
    reviewUrl ? `Leave a review / 留下评价: ${reviewUrl}` : '',
    ...next.map((item) => `${item.name} / ${item.name_zh} · ${item.date} ${item.start_time}–${item.end_time}: ${item.url}`),
    `Unsubscribe from post-session emails / 退订赛后邮件: ${unsubscribeUrl}`,
    'Booking confirmations and reminders are unaffected. / 预订确认和赛前提醒不受影响。',
  ].filter(Boolean).join('\n\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:28px;background:#edf2eb;color:#173b2f"><h1>${escapeHtml(thanks)}</h1><p>${escapeHtml(details)}</p><p>We hope to see you on court again.<br>期待下次在球场相见。</p>${reviewUrl ? `<p><a href="${escapeHtml(reviewUrl)}">Leave a review / 留下评价</a></p>` : ''}${next.length ? `<h2>Play again / 下次约球</h2><ul>${next.map((item) => `<li><a href="${escapeHtml(item.url)}">${escapeHtml(`${item.name} / ${item.name_zh} · ${item.date} ${item.start_time}–${item.end_time}`)}</a></li>`).join('')}</ul>` : ''}<p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from post-session emails / 退订赛后邮件</a></p><p>Booking confirmations and reminders are unaffected.<br>预订确认和赛前提醒不受影响。</p></div>`;
  return { subject: `Thanks for playing / 感谢参与 · ${venue.name}`, text, html };
}
export async function sendBookingFollowupEmail(input: BookingFollowupInput): Promise<EmailSendResult> {
  const transport = smtpTransport();
  const { EMAIL_FROM } = getRuntimeEnv();
  if (!transport || !EMAIL_FROM) return { status: 'skipped' };
  const result = await transport.sendMail({
    from: EMAIL_FROM, to: input.booking.email, ...renderBookingFollowupEmail(input),
    // RFC 8058 one-click unsubscribe; the endpoint accepts the POST that mail clients send.
    headers: { 'List-Unsubscribe': `<${input.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  });
  return { status: 'sent', messageId: result.messageId };
}

export type AutoRefundEmailInput = BookingEmailInput & { refunded: boolean };
export function renderAutoRefundEmail({ booking, session, venue, refunded }: AutoRefundEmailInput): RenderedBookingEmail {
  const details = `${venue.name} / ${venue.nameZh} · ${session.date} ${session.start_time}–${session.end_time}`;
  const outcome = refunded
    ? [`We have refunded ${formatMoney(booking.total_pence)} to your original payment method. It usually arrives within 5–10 working days.`, `已将 ${formatMoney(booking.total_pence)} 全额原路退回，一般 5–10 个工作日到账。`]
    : ['Your booking has been cancelled. Nothing was charged.', '你的预订已取消，未产生任何费用。'];
  const lines = [
    `Hi ${booking.contact_name},`,
    'No other player joined this session 24 hours before it starts, so it will not go ahead.',
    '开赛前 24 小时仍没有其他球友报名，这场活动取消。',
    details, ...outcome,
    `Booking reference / 预订编号: ${booking.id}`,
    'See other sessions / 查看其他场次: https://www.tennismatch.space',
  ];
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:28px;background:#edf2eb;color:#173b2f">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>`;
  return { subject: `${refunded ? 'Refunded' : 'Cancelled'}: no partner joined / 未凑齐球友${refunded ? '，已退款' : '，已取消'} · ${venue.name}`, text: lines.join('\n\n'), html };
}
export async function sendAutoRefundEmail(input: AutoRefundEmailInput): Promise<EmailSendResult> {
  const transport = smtpTransport();
  const { EMAIL_FROM } = getRuntimeEnv();
  if (!transport || !EMAIL_FROM) return { status: 'skipped' };
  const result = await transport.sendMail({ from: EMAIL_FROM, to: input.booking.email, ...renderAutoRefundEmail(input) });
  return { status: 'sent', messageId: result.messageId };
}
export function sendAdminAutoRefundSummary(outcomes: Array<{ bookingId: string; sessionId: string; email: string; status: string }>) {
  const failed = outcomes.filter((item) => item.status === 'failed').length;
  return sendAdminEmail(renderAdminDetails(
    `自动退款：${outcomes.length - failed} 笔完成${failed ? `，${failed} 笔失败需手动处理` : ''} · Auto refunds`,
    Object.fromEntries(outcomes.map((item) => [item.bookingId, `${item.status} · ${item.email} · session ${item.sessionId}`])),
  ));
}

export async function sendAdminReviewNotification(details: Record<string, unknown>) {
  try { return await sendAdminEmail(renderAdminDetails('新球友评价待审核 · New review to moderate', details)); }
  catch { console.error('Admin review notification failed', details.id); return { status: 'skipped' as const }; }
}

export type AdminCancellationEmailInput = BookingEmailInput & { refunded: boolean };
export function renderAdminCancellationEmail({ booking, session, venue, refunded }: AdminCancellationEmailInput): RenderedBookingEmail {
  const details = `${venue.name} / ${venue.nameZh} · ${session.date} ${session.start_time}–${session.end_time}`;
  const outcome = refunded
    ? [`We have refunded ${formatMoney(booking.total_pence)} to your original payment method. It usually arrives within 5–10 working days.`, `已将 ${formatMoney(booking.total_pence)} 全额原路退回，一般 5–10 个工作日到账。`]
    : ['If you have questions about payment, reply to this email.', '如对付款有疑问，请直接回复本邮件。'];
  const lines = [
    `Hi ${booking.contact_name},`,
    'Your booking has been cancelled by the Tennis Match team.',
    '你的预订已由 Tennis Match 取消。',
    details, ...outcome,
    `Booking reference / 预订编号: ${booking.id}`,
    'See other sessions / 查看其他场次: https://www.tennismatch.space',
  ];
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:28px;background:#edf2eb;color:#173b2f">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>`;
  return { subject: `Booking cancelled / 预订已取消${refunded ? '，已退款' : ''} · ${venue.name}`, text: lines.join('\n\n'), html };
}
export async function sendAdminCancellationEmail(input: AdminCancellationEmailInput): Promise<EmailSendResult> {
  const transport = smtpTransport();
  const { EMAIL_FROM } = getRuntimeEnv();
  if (!transport || !EMAIL_FROM) return { status: 'skipped' };
  const result = await transport.sendMail({ from: EMAIL_FROM, to: input.booking.email, ...renderAdminCancellationEmail(input) });
  return { status: 'sent', messageId: result.messageId };
}
