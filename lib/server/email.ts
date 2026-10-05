import type { BookingRow, SessionRow } from './database';
import { getRuntimeEnv } from './runtime';
import nodemailer from 'nodemailer';
import type { Venue } from '../demo-data';

const LONDON_TIME_ZONE = 'Europe/London';

export type BookingEmailInput = {
  booking: BookingRow;
  session: Pick<
    SessionRow,
    'date' | 'start_time' | 'end_time' | 'description' | 'description_zh'
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
  const description = [
    `Booking reference: ${booking.id}`,
    `Format: ${formatFormat(booking.format)}`,
    `Participants: ${participants.length}`,
    `Rackets: ${booking.racket_count}`,
    `Activity: ${session.description || 'Tennis session'}`,
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
    `LOCATION:${escapeIcs(`${venue.name}, ${venue.area}, London`)}`,
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
  const activityDescription = session.description || 'Tennis session';
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
