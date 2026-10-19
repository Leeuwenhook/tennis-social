import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deleteReviewCompletely,
  loadReviewContext,
  reviewWindow,
  serializePublicReview,
  validateReviewSubmission,
  verifyUploadedMedia,
  type ReviewMediaRow,
  type ReviewRow,
} from '../lib/server/reviews';
import { signToken } from '../lib/server/signed-token';
import type { Database } from '../lib/server/database';

const SECRET = 'x'.repeat(40);
const options = { mediaEnabled: true, videoEnabled: false };
const blobUrl = (path: string) => `https://abc.public.blob.vercel-storage.com/${path}`;
const image = (name: string) => ({ kind: 'image', url: blobUrl(`reviews/b1/${name}`), pathname: `reviews/b1/${name}` });
const base = { displayName: '  Ana  ', body: 'Great hit', consentPublic: true, language: 'zh' };

async function withSecret(run: () => Promise<void>) {
  const previous = process.env.REVIEW_TOKEN_SECRET;
  process.env.REVIEW_TOKEN_SECRET = SECRET;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.REVIEW_TOKEN_SECRET;
    else process.env.REVIEW_TOKEN_SECRET = previous;
  }
}

void test('reviews open when the session ends and close 30 days later', () => {
  assert.deepEqual(reviewWindow('2026-10-01', '20:00', new Date('2026-10-01T18:59:00Z')), { ended: false, open: false });
  assert.deepEqual(reviewWindow('2026-10-01', '20:00', new Date('2026-10-01T19:00:00Z')), { ended: true, open: true });
  assert.deepEqual(reviewWindow('2026-10-01', '20:00', new Date('2026-11-01T00:00:00Z')), { ended: true, open: false });
});

void test('submissions are trimmed and need consent', () => {
  assert.deepEqual(validateReviewSubmission(base, 'b1', options), {
    displayName: 'Ana', rating: null, body: 'Great hit', language: 'zh', consentMedia: false, media: [],
  });
  assert.equal(validateReviewSubmission({ ...base, consentPublic: false }, 'b1', options), null);
  assert.equal(validateReviewSubmission({ ...base, body: '   ' }, 'b1', options), null);
  assert.equal(validateReviewSubmission({ ...base, body: 'x'.repeat(1001) }, 'b1', options), null);
  assert.equal(validateReviewSubmission({ ...base, rating: 6 }, 'b1', options), null);
  assert.equal(validateReviewSubmission({ ...base, displayName: 'A\u0000na' }, 'b1', options)?.displayName, 'Ana');
});

void test('media must belong to the booking, carry consent and respect the limits', () => {
  const ok = validateReviewSubmission({ ...base, consentMedia: true, media: [image('1.jpg')] }, 'b1', options);
  assert.equal(ok?.media.length, 1);
  assert.equal(validateReviewSubmission({ ...base, media: [image('1.jpg')] }, 'b1', options), null, 'no media consent');
  assert.equal(validateReviewSubmission({ ...base, consentMedia: true, media: [image('1.jpg')] }, 'b2', options), null, 'other booking');
  assert.equal(
    validateReviewSubmission({ ...base, consentMedia: true, media: [{ ...image('1.jpg'), url: 'https://evil.example/reviews/b1/1.jpg' }] }, 'b1', options),
    null,
    'foreign host',
  );
  const six = Array.from({ length: 6 }, (_, index) => image(`${index}.jpg`));
  assert.equal(validateReviewSubmission({ ...base, consentMedia: true, media: six }, 'b1', options), null, 'too many photos');
  const video = { kind: 'video', url: blobUrl('reviews/b1/v.mp4'), pathname: 'reviews/b1/v.mp4' };
  assert.equal(validateReviewSubmission({ ...base, consentMedia: true, media: [video] }, 'b1', options), null, 'video off');
  assert.equal(validateReviewSubmission({ ...base, consentMedia: true, media: [video] }, 'b1', { ...options, videoEnabled: true })?.media.length, 1);
  assert.equal(validateReviewSubmission({ ...base, consentMedia: true, media: [image('1.jpg')] }, 'b1', { ...options, mediaEnabled: false }), null);
});

void test('uploaded files are rechecked with Blob', async () => {
  const media = validateReviewSubmission({ ...base, consentMedia: true, media: [image('1.jpg')] }, 'b1', options)!.media;
  const head = (size: number, contentType: string) => (() => Promise.resolve({ pathname: 'reviews/b1/1.jpg', size, contentType })) as never;
  assert.equal((await verifyUploadedMedia(media, head(1000, 'image/jpeg')))?.[0].size, 1000);
  assert.equal(await verifyUploadedMedia(media, head(11 * 1024 * 1024, 'image/jpeg')), null);
  assert.equal(await verifyUploadedMedia(media, head(1000, 'text/html')), null);
});

const review: ReviewRow = {
  id: 'r1', booking_id: 'b1', session_id: 's1', venue_id: 'v1', display_name: 'Ana', rating: 5, body: 'Great',
  language: 'en', status: 'approved', consent_public: true, consent_media: true, consent_at: '', moderation_note: 'internal',
  moderated_at: null, created_at: '2026-10-05T10:00:00Z', updated_at: '',
};
const mediaRow = (status: ReviewMediaRow['status']) => ({ id: status, review_id: 'r1', kind: 'image', blob_url: `u-${status}`, status, width: 10, height: 10 }) as ReviewMediaRow;

void test('public reviews hide booking details, show months and only approved media', () => {
  const output = serializePublicReview(review, [mediaRow('approved'), mediaRow('rejected')]);
  assert.equal(output.month, '2026-10');
  assert.deepEqual(output.media.map((item) => item.url), ['u-approved']);
  assert.equal(JSON.stringify(output).includes('b1'), false);
  assert.equal(JSON.stringify(output).includes('internal'), false);
  assert.deepEqual(serializePublicReview({ ...review, consent_media: false }, [mediaRow('approved')]).media, []);
});

void test('review links reject other token purposes and unconfirmed bookings', async () => {
  const queries: string[] = [];
  const db = ((parts: TemplateStringsArray) => {
    queries.push(parts.join('?'));
    return Promise.resolve([{ booking_id: 'b1', booking_status: 'refunded', contact_name: 'Ana Lee', date: '2026-10-01', end_time: '20:00' }]);
  }) as unknown as Database;
  await withSecret(async () => {
    const unsubscribe = signToken('unsubscribe', { b: 'b1', v: 1 }, 3600);
    assert.equal(await loadReviewContext(db, unsubscribe), null);
    assert.equal(queries.length, 0);
    const token = signToken('review', { b: 'b1', v: 1 }, 3600);
    assert.equal(await loadReviewContext(db, token, new Date('2026-10-02T00:00:00Z')), null);
  });
});

void test('deleting a review removes files before the row', async () => {
  const order: string[] = [];
  const db = ((parts: TemplateStringsArray) => {
    const sql = parts.join('?');
    order.push(sql.trim().split(/\s+/)[0]);
    return Promise.resolve(sql.startsWith('SELECT') ? [{ blob_url: 'u1' }] : []);
  }) as unknown as Database;
  await deleteReviewCompletely(db, 'r1', (async (urls: string[]) => {
    order.push(`del:${urls.join(',')}`);
  }) as never);
  assert.deepEqual(order, ['SELECT', 'del:u1', 'DELETE']);
});
