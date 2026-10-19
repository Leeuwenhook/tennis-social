/** Limits shared by the review form and the server. */
export const REVIEW_LIMITS = {
  images: 5,
  videos: 1,
  imageBytes: 10 * 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  videoSeconds: 60,
  bodyMax: 1000,
  nameMax: 40,
} as const;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export type ReviewMediaKind = 'image' | 'video';

export type PublicReview = {
  id: string;
  displayName: string;
  rating: number | null;
  body: string;
  language: 'en' | 'zh';
  /** Month only, e.g. "2026-10", so a review cannot be tied to one session. */
  month: string;
  media: Array<{ kind: ReviewMediaKind; url: string; width: number | null; height: number | null }>;
};

/** Blob path every upload for a booking must live under. */
export function reviewMediaPrefix(bookingId: string) {
  return `reviews/${bookingId}/`;
}
