import type { BookingRow, SessionRow } from './database';
import { getRuntimeEnv } from './runtime';
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
  return format === 'doubles' ? 'Doubles / 双打' : 'Singles / 单打';
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
    `Booking reference / 订票编号: ${booking.id}`,
    `Format / 比赛形式: ${formatFormat(booking.format)}`,
    `Participants / 参与人数: ${participants.length}`,
    `Rackets / 球拍: ${booking.racket_count}`,
    `Activity / 活动: ${session.description}`,
  ].join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tennis Social//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(booking.id)}@tennis-social`,
    `DTSTAMP:${utcIcsDate(now)}`,
    `DTSTART;TZID=${LONDON_TIME_ZONE}:${localIcsDate(session.date, session.start_time)}`,
    `DTEND;TZID=${LONDON_TIME_ZONE}:${localIcsDate(session.date, session.end_time)}`,
    `SUMMARY:${escapeIcs(`Tennis Social: ${venue.name}`)}`,
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

function buildEmail(input: BookingEmailInput) {
  const { booking, session, venue } = input;
  const participants = parseParticipants(booking.participants_json);
  const date = formatLongDate(session.date);
  const time = `${session.start_time}–${session.end_time} (${LONDON_TIME_ZONE})`;
  const format = formatFormat(booking.format);
  const activityDescription = session.description || session.description_zh;
  const participantRows = participants.length
    ? participants
        .map(
          (level, index) =>
            `<li>Participant ${index + 1} / 参与者 ${index + 1}: ${escapeHtml(level)}</li>`,
        )
        .join('')
    : '<li>See your booking record / 详见订票记录</li>';
  const html = `
    <div style="background:#f4f7f2;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#173b2f;line-height:1.6">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8dc;border-radius:16px;overflow:hidden">
        <div style="padding:28px 32px;background:#173b2f;color:#ffffff">
          <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#d5eb85">Tennis Social</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2">Booking confirmed · 预订成功</h1>
        </div>
        <div style="padding:28px 32px">
          <p>Hi ${escapeHtml(booking.contact_name)}, your payment was successful and your place is confirmed.</p>
          <p>你好 ${escapeHtml(booking.contact_name)}，你的付款已成功，活动名额已经确认。</p>
          <div style="margin:24px 0;padding:18px 20px;background:#f4f7f2;border-radius:12px">
            <div style="font-size:12px;color:#557064;text-transform:uppercase;letter-spacing:1px">Booking reference / 订票编号</div>
            <div style="font-size:22px;font-weight:700;margin-top:4px">${escapeHtml(booking.id)}</div>
          </div>
          <h2 style="font-size:18px;margin:24px 0 10px">Activity details / 活动信息</h2>
          <table role="presentation" style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#557064;width:42%">Location / 地点</td><td style="padding:8px 0;font-weight:700">${escapeHtml(`${venue.name} · ${venue.area}`)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Date / 日期</td><td style="padding:8px 0;font-weight:700">${escapeHtml(date)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Time / 时间</td><td style="padding:8px 0;font-weight:700">${escapeHtml(time)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Format / 比赛形式</td><td style="padding:8px 0;font-weight:700">${escapeHtml(format)}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Participants / 参与人数</td><td style="padding:8px 0;font-weight:700">${participants.length}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Rackets / 球拍</td><td style="padding:8px 0;font-weight:700">${booking.racket_count}</td></tr>
            <tr><td style="padding:8px 0;color:#557064">Total paid / 已付总额</td><td style="padding:8px 0;font-weight:700">${formatMoney(booking.total_pence)}</td></tr>
          </table>
          <p style="margin:20px 0 8px;font-weight:700">Activity / 活动介绍</p>
          <p style="margin:0;color:#557064">${escapeHtml(activityDescription)}</p>
          <p style="margin:20px 0 8px;font-weight:700">Levels / 参与者水平</p>
          <ul style="margin:0;padding-left:22px;color:#557064">${participantRows}</ul>
          <div style="margin-top:26px;padding:16px 18px;border:1px solid #dce8dc;border-radius:12px">
            <strong>Calendar invite attached / 日程已附上</strong>
            <div style="color:#557064;margin-top:4px">Open the attached .ics file to add this activity to Google Calendar, Apple Calendar or Outlook.</div>
            <div style="color:#557064;margin-top:4px">打开附件中的 .ics 文件，即可添加到 Google 日历、Apple 日历或 Outlook。</div>
          </div>
          <p style="margin:24px 0 0;color:#557064;font-size:13px">Please keep this email for your booking details. See you on court!</p>
        </div>
      </div>
    </div>
  `;
  const text = [
    'Tennis Social — Booking confirmed / 预订成功',
    '',
    `Hi ${booking.contact_name}, your payment was successful and your place is confirmed.`,
    `你好 ${booking.contact_name}，你的付款已成功，活动名额已经确认。`,
    '',
    `Booking reference / 订票编号: ${booking.id}`,
    `Location / 地点: ${venue.name} · ${venue.area}`,
    `Date / 日期: ${date}`,
    `Time / 时间: ${time}`,
    `Format / 比赛形式: ${format}`,
    `Participants / 参与人数: ${participants.length}`,
    `Rackets / 球拍: ${booking.racket_count}`,
    `Total paid / 已付总额: ${formatMoney(booking.total_pence)}`,
    `Activity / 活动介绍: ${activityDescription}`,
    `Levels / 参与者水平: ${participants.join(', ') || '—'}`,
    '',
    'A .ics calendar invite is attached. / 邮件已附 .ics 日程文件。',
  ].join('\n');
  return {
    html,
    text,
    subject: `Booking confirmed · ${venue.name} · ${session.date}`,
  };
}

export function isEmailConfigured() {
  const { RESEND_API_KEY, EMAIL_FROM } = getRuntimeEnv();
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

export async function sendBookingConfirmationEmail(
  input: BookingEmailInput,
): Promise<EmailSendResult> {
  const { RESEND_API_KEY, EMAIL_FROM } = getRuntimeEnv();
  if (!RESEND_API_KEY || !EMAIL_FROM) return { status: 'skipped' };

  const email = buildEmail(input);
  const calendar = createBookingCalendar(input);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `booking-confirmation-${input.booking.id}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [input.booking.email],
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: [
        {
          filename: 'tennis-social-booking.ics',
          content: Buffer.from(calendar, 'utf8').toString('base64'),
        },
      ],
    }),
  });
  const rawBody = await response.text();
  let body: { id?: unknown; message?: unknown } = {};
  try {
    body = JSON.parse(rawBody) as { id?: unknown; message?: unknown };
  } catch {
    // The provider can return a non-JSON error body during an upstream outage.
  }
  if (!response.ok) {
    const detail =
      typeof body.message === 'string'
        ? body.message
        : `HTTP ${response.status}`;
    throw new Error(`email_provider_error: ${detail}`);
  }
  if (typeof body.id !== 'string' || !body.id)
    throw new Error('email_provider_missing_id');
  return { status: 'sent', messageId: body.id };
}
