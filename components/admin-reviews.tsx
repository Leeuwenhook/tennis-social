'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Language } from '@/types/tennis';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden';

type AdminReview = {
  id: string;
  status: ReviewStatus;
  displayName: string;
  rating: number | null;
  body: string;
  consentMedia: boolean;
  moderationNote: string;
  createdAt: string;
  contactName: string;
  email: string;
  venueName: string;
  session: string;
  media: Array<{ id: string; kind: 'image' | 'video'; url: string; status: string; sizeBytes: number; durationSeconds: number | null }>;
};

const STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected', 'hidden'];

const copy = {
  en: {
    eyebrow: 'Reviews',
    title: 'Review moderation',
    intro: 'Reviews from players appear on the venue page only after approval. Contact details are visible to admins only.',
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected', hidden: 'Hidden',
    approve: 'Approve', reject: 'Reject', hide: 'Hide', restore: 'Restore',
    rejectMedia: 'Reject file', approveMedia: 'Approve file',
    delete: 'Delete permanently',
    confirmDelete: 'Delete this review and its files permanently? This cannot be undone.',
    note: 'Moderation note (optional)',
    noMediaConsent: 'No consent to show media publicly',
    empty: 'No reviews here.',
    error: 'Reviews could not be loaded.',
    refresh: 'Refresh',
    openFile: 'Open full-size photo',
  },
  zh: {
    eyebrow: '评价',
    title: '评价审核',
    intro: '球友评价审核通过后才会显示在场地页。联系方式仅管理员可见。',
    pending: '待审核', approved: '已通过', rejected: '已拒绝', hidden: '已隐藏',
    approve: '通过', reject: '拒绝', hide: '隐藏', restore: '恢复',
    rejectMedia: '拒绝此文件', approveMedia: '通过此文件',
    delete: '永久删除',
    confirmDelete: '确定永久删除这条评价和文件吗？此操作无法撤销。',
    note: '审核备注（可选）',
    noMediaConsent: '未同意公开图片/视频',
    empty: '暂无评价。',
    error: '评价加载失败。',
    refresh: '刷新',
    openFile: '查看原图',
  },
} as const;

function sizeLabel(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function AdminReviews({ language, onPendingCount }: { language: Language; onPendingCount?: (count: number) => void }) {
  const c = copy[language];
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [counts, setCounts] = useState<Partial<Record<ReviewStatus, number>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/reviews?status=${status}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const data = (await response.json()) as { reviews: AdminReview[]; counts: Partial<Record<ReviewStatus, number>> };
        if (cancelled) return;
        setReviews(data.reviews);
        setCounts(data.counts);
        setError(false);
        onPendingCount?.(data.counts.pending ?? 0);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, reloadKey, onPendingCount]);

  async function moderate(review: AdminReview, next: ReviewStatus, mediaStatus?: Record<string, string>) {
    setBusy(true);
    try {
      await fetch(`/api/admin/reviews/${encodeURIComponent(review.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, moderationNote: notes[review.id], mediaStatus }),
      });
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(review: AdminReview) {
    if (!window.confirm(c.confirmDelete)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/reviews/${encodeURIComponent(review.id)}`, { method: 'DELETE' });
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-bookings admin-reviews">
      <div className="admin-list-heading">
        <div>
          <p className="eyebrow muted">{c.eyebrow}</p>
          <h2>{c.title}</h2>
          <p>{c.intro}</p>
        </div>
        <div className="admin-session-import-actions">
          {STATUSES.map((value) => (
            <Button key={value} size="sm" variant={status === value ? 'default' : 'outline'} onClick={() => setStatus(value)}>
              {c[value]}
              {counts[value] ? ` (${counts[value]})` : ''}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={reload} disabled={busy}>{c.refresh}</Button>
        </div>
      </div>
      {error ? <div className="empty-state">{c.error}</div> : null}
      {!error && !reviews.length ? <div className="empty-state">{c.empty}</div> : null}
      <div className="admin-review-list">
        {reviews.map((review) => (
          <article key={review.id} className="admin-review">
            <header>
              <strong>{review.venueName}</strong>
              <span>{review.session}</span>
              <Badge variant="secondary">{c[review.status]}</Badge>
            </header>
            <p className="admin-review-contact">
              {review.contactName} · {review.email} · {new Date(review.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-GB')}
            </p>
            <p>
              <strong>{review.displayName}</strong>
              {review.rating ? ` · ${'★'.repeat(review.rating)}` : ''}
            </p>
            <p className="admin-review-body">{review.body}</p>
            {review.media.length ? (
              <>
                {!review.consentMedia ? <p className="admin-review-warning">{c.noMediaConsent}</p> : null}
                <div className="admin-review-media">
                  {review.media.map((item) => (
                    <figure key={item.id} className={item.status === 'rejected' ? 'is-rejected' : ''}>
                      {item.kind === 'image' ? (
                        <a href={item.url} target="_blank" rel="noreferrer" aria-label={c.openFile}>
                          <img src={item.url} alt="" loading="lazy" />
                        </a>
                      ) : (
                        // oxlint-disable-next-line jsx-a11y/media-has-caption -- player-recorded clips have no captions
                        <video src={item.url} controls preload="metadata" playsInline />
                      )}
                      <figcaption>
                        {item.status} · {sizeLabel(item.sizeBytes)}
                        {item.durationSeconds ? ` · ${item.durationSeconds}s` : ''}
                      </figcaption>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void moderate(review, review.status, { [item.id]: item.status === 'rejected' ? 'approved' : 'rejected' })}
                      >
                        {item.status === 'rejected' ? c.approveMedia : c.rejectMedia}
                      </Button>
                    </figure>
                  ))}
                </div>
              </>
            ) : null}
            <Input
              className="admin-review-note"
              aria-label={c.note}
              placeholder={c.note}
              maxLength={500}
              value={notes[review.id] ?? review.moderationNote}
              onChange={(event) => setNotes((current) => ({ ...current, [review.id]: event.target.value }))}
            />
            <div className="admin-row-actions">
              {review.status !== 'approved' ? (
                <Button size="sm" disabled={busy} onClick={() => void moderate(review, 'approved')}>
                  {review.status === 'hidden' ? c.restore : c.approve}
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void moderate(review, 'hidden')}>{c.hide}</Button>
              )}
              {review.status === 'pending' ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void moderate(review, 'rejected')}>{c.reject}</Button>
              ) : null}
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(review)}>{c.delete}</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
