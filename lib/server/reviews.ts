import { del, head } from '@vercel/blob';

import {
  IMAGE_TYPES,
  REVIEW_LIMITS,
  reviewMediaPrefix,
  VIDEO_TYPES,
  type PublicReview,
  type ReviewMediaKind,
} from '../review-rules';
import type { Database } from './database';
import { londonSessionEnd } from './london-time';
import { getRuntimeEnv } from './runtime';
import { signToken, verifyToken } from './signed-token';

const DAY = 86400000;
/** Reviews can be written for this long after the session ends. */
const SUBMIT_WINDOW_DAYS = 30;
/** The emailed link stays valid this long, so people can still delete their review. */
const TOKEN_TTL_SECONDS = 90 * 86400;
const SITE_ORIGIN = 'https://www.tennismatch.space';

export function reviewsEnabled() {
  return getRuntimeEnv().REVIEWS_ENABLED === 'true';
}

export function reviewVideoEnabled() {
  return getRuntimeEnv().REVIEW_VIDEO_ENABLED === 'true';
}

export function reviewMediaEnabled() {
  return Boolean(getRuntimeEnv().BLOB_READ_WRITE_TOKEN);
}

export function reviewUrlFor(bookingId: string, now = new Date()) {
  const token = signToken('review', { b: bookingId, v: 1 }, TOKEN_TTL_SECONDS, now);
  return `${SITE_ORIGIN}/review?t=${encodeURIComponent(token)}`;
}

export type ReviewRow = {
  id: string;
  booking_id: string;
  session_id: string;
  venue_id: string;
  display_name: string;
  rating: number | null;
  body: string;
  language: 'en' | 'zh';
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  consent_public: boolean;
  consent_media: boolean;
  consent_at: string;
  moderation_note: string;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewMediaRow = {
  id: string;
  review_id: string | null;
  booking_id: string;
  kind: ReviewMediaKind;
  blob_url: string;
  blob_pathname: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  status: 'uploaded' | 'pending' | 'approved' | 'rejected';
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ContextRow = {
  booking_id: string;
  booking_status: string;
  contact_name: string;
  session_id: string;
  venue_id: string;
  date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  venue_name_zh: string;
};

export type ReviewContext = {
  bookingId: string;
  sessionId: string;
  venueId: string;
  firstName: string;
  venueName: string;
  venueNameZh: string;
  date: string;
  startTime: string;
  endTime: string;
  canSubmit: boolean;
  review: (ReviewRow & { media: ReviewMediaRow[] }) | null;
};

/** Who may review: a confirmed booking whose session ended within the last 30 days. */
export function reviewWindow(date: string, endTime: string, now = new Date()) {
  const endedAt = londonSessionEnd(date, endTime);
  if (endedAt === null) return { ended: false, open: false };
  const ended = now.getTime() >= endedAt;
  return { ended, open: ended && now.getTime() <= endedAt + SUBMIT_WINDOW_DAYS * DAY };
}

/** Verifies a review link and loads what the form needs. Null means the link is invalid. */
export async function loadReviewContext(db: Database, token: string, now = new Date()): Promise<ReviewContext | null> {
  const payload = verifyToken('review', token, now);
  if (!payload || typeof payload.b !== 'string') return null;
  const rows = (await db`
    SELECT bookings.id AS booking_id, bookings.status AS booking_status, bookings.contact_name,
           sessions.id AS session_id, sessions.venue_id, sessions.date, sessions.start_time, sessions.end_time,
           venues.name AS venue_name, venues.name_zh AS venue_name_zh
    FROM bookings
    JOIN sessions ON sessions.id = bookings.session_id
    JOIN venues ON venues.id = sessions.venue_id
    WHERE bookings.id = ${payload.b}
  `) as ContextRow[];
  const row = rows[0];
  // A refunded or cancelled booking loses its review link.
  if (!row || row.booking_status !== 'confirmed') return null;
  const timing = reviewWindow(row.date, row.end_time, now);
  if (!timing.ended) return null;
  const reviews = (await db`SELECT * FROM session_reviews WHERE booking_id = ${row.booking_id}`) as ReviewRow[];
  const media = reviews[0]
    ? ((await db`SELECT * FROM review_media WHERE review_id = ${reviews[0].id} ORDER BY sort_order`) as ReviewMediaRow[])
    : [];
  return {
    bookingId: row.booking_id,
    sessionId: row.session_id,
    venueId: row.venue_id,
    firstName: row.contact_name.trim().split(/\s+/)[0]?.slice(0, REVIEW_LIMITS.nameMax) ?? '',
    venueName: row.venue_name,
    venueNameZh: row.venue_name_zh,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    canSubmit: timing.open && !reviews[0],
    review: reviews[0] ? { ...reviews[0], media } : null,
  };
}

export type SubmittedMedia = {
  url: string;
  pathname: string;
  kind: ReviewMediaKind;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

export type ValidReviewSubmission = {
  displayName: string;
  rating: number | null;
  body: string;
  language: 'en' | 'zh';
  consentMedia: boolean;
  media: SubmittedMedia[];
};

// Control characters other than tab and newline.
// oxlint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function cleanText(value: unknown, max: number, singleLine: boolean) {
  if (typeof value !== 'string') return '';
  const text = value.replace(CONTROL, '');
  return (singleLine ? text.replace(/\s+/g, ' ') : text).trim().slice(0, max);
}

function optionalInt(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 100000 ? value : null;
}

/** Validates the submit body. Media ownership and real sizes are checked separately against Blob. */
export function validateReviewSubmission(
  input: unknown,
  bookingId: string,
  options: { videoEnabled: boolean; mediaEnabled: boolean },
): ValidReviewSubmission | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const displayName = cleanText(value.displayName, REVIEW_LIMITS.nameMax, true);
  const body = cleanText(value.body, REVIEW_LIMITS.bodyMax, false);
  if (!displayName || !body) return null;
  if (typeof value.body === 'string' && value.body.trim().length > REVIEW_LIMITS.bodyMax) return null;
  const rating = value.rating === null || value.rating === undefined ? null : value.rating;
  if (rating !== null && !(typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5)) return null;
  if (value.consentPublic !== true) return null;
  const language = value.language === 'zh' ? 'zh' : 'en';
  const rawMedia = Array.isArray(value.media) ? value.media : [];
  if (rawMedia.length && !options.mediaEnabled) return null;
  const media: SubmittedMedia[] = [];
  for (const item of rawMedia) {
    if (!item || typeof item !== 'object') return null;
    const entry = item as Record<string, unknown>;
    const kind = entry.kind === 'video' ? 'video' : entry.kind === 'image' ? 'image' : null;
    if (!kind || typeof entry.url !== 'string' || typeof entry.pathname !== 'string') return null;
    if (!entry.pathname.startsWith(reviewMediaPrefix(bookingId))) return null;
    let url: URL;
    try {
      url = new URL(entry.url);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.vercel-storage.com') || url.pathname !== `/${entry.pathname}`) return null;
    media.push({
      url: entry.url,
      pathname: entry.pathname,
      kind,
      width: optionalInt(entry.width),
      height: optionalInt(entry.height),
      durationSeconds: optionalInt(entry.durationSeconds),
    });
  }
  const images = media.filter((item) => item.kind === 'image').length;
  const videos = media.length - images;
  if (images > REVIEW_LIMITS.images || videos > (options.videoEnabled ? REVIEW_LIMITS.videos : 0)) return null;
  if (new Set(media.map((item) => item.pathname)).size !== media.length) return null;
  if (media.length && value.consentMedia !== true) return null;
  return { displayName, rating, body, language, consentMedia: media.length > 0, media };
}

/** Confirms each uploaded file with Blob itself, so the client cannot lie about type or size. */
export async function verifyUploadedMedia(media: SubmittedMedia[], lookup: typeof head = head) {
  const verified: Array<SubmittedMedia & { contentType: string; size: number }> = [];
  for (const item of media) {
    const blob = await lookup(item.url);
    const types = item.kind === 'video' ? VIDEO_TYPES : IMAGE_TYPES;
    const max = item.kind === 'video' ? REVIEW_LIMITS.videoBytes : REVIEW_LIMITS.imageBytes;
    if (blob.pathname !== item.pathname || !types.includes(blob.contentType) || blob.size > max) return null;
    verified.push({ ...item, contentType: blob.contentType, size: blob.size });
  }
  return verified;
}

function month(value: string) {
  return value.slice(0, 7);
}

export function serializePublicReview(row: ReviewRow, media: ReviewMediaRow[]): PublicReview {
  return {
    id: row.id,
    displayName: row.display_name.slice(0, REVIEW_LIMITS.nameMax),
    rating: row.rating,
    body: row.body,
    language: row.language,
    month: month(row.created_at),
    media: row.consent_media
      ? media
          .filter((item) => item.status === 'approved')
          .map((item) => ({ kind: item.kind, url: item.blob_url, width: item.width, height: item.height }))
      : [],
  };
}

/** Deletes a review with its files. Blobs go first so no file outlives its row. */
export async function deleteReviewCompletely(db: Database, reviewId: string, remove: typeof del = del) {
  const media = (await db`SELECT blob_url FROM review_media WHERE review_id = ${reviewId}`) as Array<{ blob_url: string }>;
  if (media.length) await remove(media.map((item) => item.blob_url));
  await db`DELETE FROM session_reviews WHERE id = ${reviewId}`;
}
