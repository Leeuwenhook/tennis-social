'use client';

import { useEffect, useState } from 'react';
import Search from 'lucide-react/dist/esm/icons/search.mjs';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Venue } from '@/lib/demo-data';
import { formatMoney } from '@/lib/formatters';
import type { Booking, BookingStatus, Language } from '@/types/tennis';

type AdminBooking = Booking & {
  paid: boolean;
  session: { date: string; startTime: string; endTime: string; venueId: string; venueName: string };
};

type Scope = 'upcoming' | 'past' | 'all';

const STATUSES: BookingStatus[] = ['confirmed', 'pending_payment', 'cancelled', 'refunded', 'expired', 'payment_failed'];

const copy = {
  en: {
    eyebrow: 'Bookings',
    title: 'Booking list',
    upcoming: 'Upcoming', past: 'Past', all: 'All',
    venue: 'Venue', allVenues: 'All venues',
    status: 'Status', allStatuses: 'All statuses',
    search: 'Search name, email, phone or reference',
    statuses: { confirmed: 'Confirmed', pending_payment: 'Paying', cancelled: 'Cancelled', refunded: 'Refunded', expired: 'Expired', payment_failed: 'Payment failed' },
    contact: 'Contact', session: 'Session', players: 'Players', total: 'Total', actions: '',
    cancel: 'Cancel',
    loadMore: 'Load more',
    loading: 'Loading…',
    empty: 'No bookings match.',
    error: 'Bookings could not be loaded.',
    cancelTitle: 'Cancel this booking?',
    cancelBody: 'The places are released and the player gets a cancellation email.',
    refund: 'Also refund {amount} in full to the original payment method',
    notPaid: 'This booking has no card payment, so there is nothing to refund.',
    confirmCancel: 'Cancel booking',
    keep: 'Keep booking',
    refundFailed: 'The refund failed, so the booking was not cancelled. Try again or refund in Stripe.',
    failed: 'The booking could not be cancelled.',
  },
  zh: {
    eyebrow: '预订',
    title: '预订列表',
    upcoming: '未来', past: '过去', all: '全部',
    venue: '场地', allVenues: '全部场地',
    status: '状态', allStatuses: '全部状态',
    search: '搜索姓名、邮箱、电话或预订号',
    statuses: { confirmed: '已确认', pending_payment: '付款中', cancelled: '已取消', refunded: '已退款', expired: '已过期', payment_failed: '付款失败' },
    contact: '联系人', session: '场次', players: '人数', total: '金额', actions: '',
    cancel: '取消',
    loadMore: '加载更多',
    loading: '加载中…',
    empty: '没有符合条件的预订。',
    error: '预订加载失败。',
    cancelTitle: '取消这个预订？',
    cancelBody: '名额会释放，球友会收到取消邮件。',
    refund: '同时将 {amount} 全额原路退回',
    notPaid: '这个预订没有银行卡付款，无需退款。',
    confirmCancel: '确认取消',
    keep: '保留预订',
    refundFailed: '退款失败，预订没有取消。请重试，或到 Stripe 后台退款。',
    failed: '预订取消失败。',
  },
} as const;

function sessionLabel(booking: AdminBooking, language: Language) {
  const day = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${booking.session.date}T12:00:00Z`),
  );
  return `${day} ${booking.session.startTime}–${booking.session.endTime}`;
}

export function AdminBookings({
  language,
  venueList,
  onBookingChanged,
}: {
  language: Language;
  venueList: Venue[];
  onBookingChanged: (bookingId: string, status: BookingStatus) => void;
}) {
  const c = copy[language];
  const [scope, setScope] = useState<Scope>('upcoming');
  const [venue, setVenue] = useState('');
  const [status, setStatus] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ key: string; bookings: AdminBooking[]; nextOffset: number | null } | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [cancelling, setCancelling] = useState<AdminBooking | null>(null);
  const [refund, setRefund] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const filterKey = JSON.stringify({ scope, venue, status, query, reloadKey });

  // Typing waits for a pause before searching.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  function url(offset: number) {
    const params = new URLSearchParams({ scope, offset: String(offset) });
    if (venue) params.set('venue', venue);
    if (status) params.set('status', status);
    if (query) params.set('q', query);
    return `/api/admin/bookings?${params.toString()}`;
  }

  useEffect(() => {
    let cancelled = false;
    fetch(url(0), { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const body = (await response.json()) as { bookings: AdminBooking[]; nextOffset: number | null };
        if (!cancelled) {
          setResult({ key: filterKey, ...body });
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- filterKey captures every input of url()
  }, [filterKey]);

  async function loadMore() {
    if (result?.nextOffset == null) return;
    const response = await fetch(url(result.nextOffset), { cache: 'no-store' });
    if (!response.ok) return;
    const body = (await response.json()) as { bookings: AdminBooking[]; nextOffset: number | null };
    setResult({ key: filterKey, bookings: [...result.bookings, ...body.bookings], nextOffset: body.nextOffset });
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(cancelling.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', refund: refund && cancelling.paid }),
      });
      const body = (await response.json().catch(() => ({}))) as { booking?: Booking; error?: string };
      if (response.ok && body.booking) {
        onBookingChanged(cancelling.id, body.booking.status);
        setCancelling(null);
        setReloadKey((key) => key + 1);
      } else {
        setMessage(body.error === 'refund_failed' ? c.refundFailed : c.failed);
      }
    } catch {
      setMessage(c.failed);
    } finally {
      setBusy(false);
    }
  }

  const loading = !error && result?.key !== filterKey;

  return (
    <div className="admin-bookings">
      <div className="admin-list-heading">
        <div>
          <p className="eyebrow muted">{c.eyebrow}</p>
          <h2>{c.title}</h2>
        </div>
      </div>
      <div className="admin-filter-bar">
        <div className="admin-segmented" role="group">
          {(['upcoming', 'past', 'all'] as const).map((value) => (
            <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)}>
              {c[value]}
            </button>
          ))}
        </div>
        <select className="native-select" aria-label={c.venue} value={venue} onChange={(event) => setVenue(event.target.value)}>
          <option value="">{c.allVenues}</option>
          {venueList.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select className="native-select" aria-label={c.status} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{c.allStatuses}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>{c.statuses[value]}</option>
          ))}
        </select>
        <div className="admin-search">
          <Search size={15} aria-hidden="true" />
          <Input value={queryInput} placeholder={c.search} aria-label={c.search} onChange={(event) => setQueryInput(event.target.value)} />
        </div>
      </div>
      {error ? <div className="empty-state">{c.error}</div> : null}
      {loading ? <div className="admin-muted">{c.loading}</div> : null}
      {!loading && result && !result.bookings.length ? <div className="empty-state">{c.empty}</div> : null}
      {result?.bookings.length ? (
        <div className="admin-booking-cards">
          {result.bookings.map((booking) => (
            <article key={booking.id} className="admin-booking-card">
              <div className="admin-booking-main">
                <strong>{booking.contactName}</strong>
                <span>{[booking.email, booking.phone].filter(Boolean).join(' · ')}</span>
                <small>{booking.id}</small>
              </div>
              <div className="admin-booking-session">
                <strong>{booking.session.venueName}</strong>
                <span>{sessionLabel(booking, language)}</span>
              </div>
              <div className="admin-booking-players">
                <strong>{booking.participants.length}</strong>
                <span>{booking.participants.join(' / ')} · {booking.format}</span>
              </div>
              <div className="admin-booking-total">{formatMoney(booking.totalPence, language)}</div>
              <span className={`admin-status status-${booking.status}`}>{c.statuses[booking.status]}</span>
              <div className="admin-booking-actions">
                {booking.status === 'confirmed' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCancelling(booking);
                      setRefund(true);
                      setMessage('');
                    }}
                  >
                    {c.cancel}
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {result?.nextOffset != null && !loading ? (
        <Button variant="outline" size="sm" onClick={() => void loadMore()}>{c.loadMore}</Button>
      ) : null}
      <Dialog open={Boolean(cancelling)} onOpenChange={(open) => !open && !busy && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{c.cancelTitle}</DialogTitle>
            <DialogDescription>
              {cancelling ? `${cancelling.contactName} · ${cancelling.session.venueName} ${sessionLabel(cancelling, language)}` : ''}
            </DialogDescription>
          </DialogHeader>
          <p className="admin-muted">{c.cancelBody}</p>
          {cancelling?.paid ? (
            <label className="admin-check">
              <input type="checkbox" checked={refund} onChange={(event) => setRefund(event.target.checked)} />
              <span>{c.refund.replace('{amount}', formatMoney(cancelling.totalPence, language))}</span>
            </label>
          ) : (
            <p className="admin-muted">{c.notPaid}</p>
          )}
          {message ? <p className="admin-error" role="alert">{message}</p> : null}
          <div className="admin-row-actions">
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void confirmCancel()}>{c.confirmCancel}</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => setCancelling(null)}>{c.keep}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
