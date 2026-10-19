import { del, list } from '@vercel/blob';

import type { Database } from './database';

const DAY = 86400000;

/**
 * Deletes review files nobody will see: uploads never attached to a submitted
 * review (after a day) and rejected media (after a week). Blob is listed
 * directly, so files whose upload callback never reached the app are caught too.
 */
export async function cleanupReviewMedia(db: Database, now = new Date(), blob = { list, del }) {
  const rejectedBefore = new Date(now.getTime() - 7 * DAY).toISOString();
  const rejected = (await db`
    SELECT id, blob_url FROM review_media WHERE status = 'rejected' AND updated_at < ${rejectedBefore}
  `) as Array<{ id: string; blob_url: string }>;
  if (rejected.length) {
    await blob.del(rejected.map((item) => item.blob_url));
    await db`DELETE FROM review_media WHERE id = ANY(${rejected.map((item) => item.id)})`;
  }

  const kept = new Set(
    ((await db`SELECT blob_pathname FROM review_media`) as Array<{ blob_pathname: string }>).map((row) => row.blob_pathname),
  );
  const orphanBefore = now.getTime() - DAY;
  const orphans: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await blob.list({ prefix: 'reviews/', cursor, limit: 1000 });
    for (const item of page.blobs) {
      if (!kept.has(item.pathname) && new Date(item.uploadedAt).getTime() < orphanBefore) orphans.push(item.url);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (orphans.length) await blob.del(orphans);
  return { rejected: rejected.length, orphans: orphans.length };
}
