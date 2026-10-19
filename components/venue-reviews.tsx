'use client';

import { useEffect, useRef, useState } from 'react';

import type { PublicReview } from '@/lib/review-rules';
import type { Language } from '@/types/tennis';

const copy = {
  en: { title: 'Player stories', more: 'Load more', close: 'Close', enlarge: 'Enlarge photo' },
  zh: { title: '球友留言', more: '加载更多', close: '关闭', enlarge: '放大照片' },
} as const;

function monthLabel(month: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

/** Approved reviews for a venue. Fetches only when scrolled into view; renders nothing when empty. */
export function VenueReviews({ venueId, language }: { venueId: string; language: Language }) {
  const c = copy[language];
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState<{ venueId: string; reviews: PublicReview[]; cursor: string | null } | null>(null);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const current = loaded?.venueId === venueId ? loaded : null;

  useEffect(() => {
    const element = rootRef.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetch(`/api/venues/${encodeURIComponent(venueId)}/reviews?limit=6`)
      .then((response) => (response.ok ? response.json() : { reviews: [], nextCursor: null }))
      .then((data: { reviews: PublicReview[]; nextCursor: string | null }) => {
        if (!cancelled) setLoaded({ venueId, reviews: data.reviews, cursor: data.nextCursor });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible, venueId]);

  async function loadMore() {
    if (!current?.cursor) return;
    const response = await fetch(`/api/venues/${encodeURIComponent(venueId)}/reviews?limit=6&cursor=${encodeURIComponent(current.cursor)}`);
    if (!response.ok) return;
    const data = (await response.json()) as { reviews: PublicReview[]; nextCursor: string | null };
    setLoaded({ venueId, reviews: [...current.reviews, ...data.reviews], cursor: data.nextCursor });
  }

  return (
    <section ref={rootRef} className="venue-reviews" aria-label={c.title} hidden={Boolean(current && !current.reviews.length)}>
      {current?.reviews.length ? (
        <>
          <h2>{c.title}</h2>
          <div className="venue-reviews-grid">
            {current.reviews.map((review) => (
              <article key={review.id} className="venue-review">
                <header>
                  <strong>{review.displayName}</strong>
                  {review.rating ? <span aria-label={`${review.rating}/5`}>{'★'.repeat(review.rating)}</span> : null}
                  <small>{monthLabel(review.month, language)}</small>
                </header>
                <p>{review.body}</p>
                {review.media.length ? (
                  <div className="review-thumbs">
                    {review.media.map((item) =>
                      item.kind === 'image' ? (
                        <button type="button" key={item.url} aria-label={c.enlarge} onClick={() => setEnlarged(item.url)}>
                          <img src={item.url} alt="" loading="lazy" decoding="async" width={item.width ?? undefined} height={item.height ?? undefined} />
                        </button>
                      ) : (
                        // oxlint-disable-next-line jsx-a11y/media-has-caption -- player-recorded clips have no captions
                        <video key={item.url} src={item.url} preload="none" controls playsInline />
                      ),
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          {current.cursor ? (
            <button type="button" className="venue-reviews-more" onClick={() => void loadMore()}>
              {c.more}
            </button>
          ) : null}
        </>
      ) : null}
      {enlarged ? (
        <button type="button" className="venue-review-lightbox" aria-label={c.close} onClick={() => setEnlarged(null)}>
          <img src={enlarged} alt="" />
        </button>
      ) : null}
    </section>
  );
}
