'use client';

import { useCallback, useEffect, useState } from 'react';
import Copy from 'lucide-react/dist/esm/icons/copy.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';

import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatters';
import type { AdminTab, Language } from '@/types/tennis';

export type RosterEntry = {
  id: string;
  contactName: string;
  email: string;
  phone: string;
  participants: string[];
  participantCount: number;
  format: string;
  totalPence: number;
  status: string;
};

type OverviewSession = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  venueName: string;
  capacity: number;
  bookedSpots: number;
  markedFull: boolean;
  status: 'published' | 'draft';
  autoRefundAt: string | null;
  roster: RosterEntry[];
};

type Overview = {
  sessions: OverviewSession[];
  pendingRequests: number;
  pendingReviews: number;
  week: { start: string; end: string; revenuePence: number; bookings: number; players: number };
};

const copy = {
  en: {
    eyebrow: 'Overview',
    title: 'Next 7 days',
    refresh: 'Refresh',
    loading: 'Loading…',
    error: 'The overview could not be loaded.',
    weekRevenue: 'Paid this week',
    weekBookings: 'Bookings this week',
    pendingRequests: 'Partner requests to review',
    pendingReviews: 'Reviews to moderate',
    atRiskTitle: 'Will be auto-refunded if nobody else joins',
    atRiskAt: 'decided {time}',
    noSessions: 'No sessions in the next 7 days.',
    noPlayers: 'No bookings yet.',
    draft: 'Draft',
    full: 'Marked full',
    pending: 'paying',
    copyRoster: 'Copy list',
    copied: 'Copied',
    players: '{count} player(s)',
  },
  zh: {
    eyebrow: '概览',
    title: '未来 7 天',
    refresh: '刷新',
    loading: '加载中…',
    error: '概览加载失败。',
    weekRevenue: '本周收款',
    weekBookings: '本周新报名',
    pendingRequests: '待处理找球友需求',
    pendingReviews: '待审核评价',
    atRiskTitle: '如果没人再报名，将被自动退款',
    atRiskAt: '{time} 判定',
    noSessions: '未来 7 天没有场次。',
    noPlayers: '还没有人报名。',
    draft: '草稿',
    full: '已标记满员',
    pending: '付款中',
    copyRoster: '复制名单',
    copied: '已复制',
    players: '{count} 人',
  },
} as const;

/** Plain-text roster for pasting into a group chat. */
export function rosterText(session: { date: string; startTime: string; endTime: string; venueName: string }, roster: RosterEntry[]) {
  const lines = roster.map(
    (entry, index) =>
      `${index + 1}. ${entry.contactName}${entry.participantCount > 1 ? ` ×${entry.participantCount}` : ''} · ${entry.participants.join('/') || '-'} · ${entry.format}${entry.phone ? ` · ${entry.phone}` : ''}`,
  );
  return [`${session.venueName} ${session.date} ${session.startTime}–${session.endTime}`, ...lines].join('\n');
}

export function CopyRosterButton({ text, language }: { text: string; language: Language }) {
  const c = copy[language];
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <Copy size={14} /> {copied ? c.copied : c.copyRoster}
    </Button>
  );
}

export function RosterList({ roster, language }: { roster: RosterEntry[]; language: Language }) {
  const c = copy[language];
  if (!roster.length) return <p className="admin-muted">{c.noPlayers}</p>;
  return (
    <ul className="admin-roster">
      {roster.map((entry) => (
        <li key={entry.id}>
          <strong>{entry.contactName}</strong>
          {entry.participantCount > 1 ? <span> ×{entry.participantCount}</span> : null}
          <span>{entry.participants.join(' / ') || '-'} · {entry.format}</span>
          <span>{[entry.email, entry.phone].filter(Boolean).join(' · ')}</span>
          <span>
            {formatMoney(entry.totalPence, language)}
            {entry.status === 'pending_payment' ? ` · ${c.pending}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function dayLabel(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function timeLabel(iso: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  }).format(new Date(iso));
}

export function AdminOverview({ language, onOpenTab }: { language: Language; onOpenTab: (tab: AdminTab) => void }) {
  const c = copy[language];
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/overview', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const body = (await response.json()) as Overview;
        if (!cancelled) {
          setData(body);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const atRisk = data?.sessions.filter((session) => session.autoRefundAt) ?? [];

  return (
    <div className="admin-overview">
      <div className="admin-list-heading">
        <div>
          <p className="eyebrow muted">{c.eyebrow}</p>
          <h2>{c.title}</h2>
        </div>
        <Button size="sm" variant="outline" onClick={reload}>{c.refresh}</Button>
      </div>
      {error ? <div className="empty-state">{c.error}</div> : null}
      {!data && !error ? <div className="empty-state">{c.loading}</div> : null}
      {data ? (
        <>
          <div className="admin-overview-stats">
            <div>
              <span>{formatMoney(data.week.revenuePence, language)}</span>
              <small>{c.weekRevenue}</small>
            </div>
            <div>
              <span>{data.week.bookings}</span>
              <small>{c.weekBookings} · {c.players.replace('{count}', String(data.week.players))}</small>
            </div>
            <button type="button" onClick={() => onOpenTab('requests')}>
              <span>{data.pendingRequests}</span>
              <small>{c.pendingRequests}</small>
            </button>
            <button type="button" onClick={() => onOpenTab('reviews')}>
              <span>{data.pendingReviews}</span>
              <small>{c.pendingReviews}</small>
            </button>
          </div>
          {atRisk.length ? (
            <div className="admin-overview-risk" role="status">
              <strong>
                <TriangleAlert size={16} /> {c.atRiskTitle}
              </strong>
              <ul>
                {atRisk.map((session) => (
                  <li key={session.id}>
                    {session.venueName} · {dayLabel(session.date, language)} {session.startTime} ·{' '}
                    {c.atRiskAt.replace('{time}', timeLabel(session.autoRefundAt!, language))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!data.sessions.length ? <div className="empty-state">{c.noSessions}</div> : null}
          <div className="admin-overview-sessions">
            {data.sessions.map((session) => (
              <article key={session.id} className={`admin-overview-session${session.status === 'draft' ? ' is-draft' : ''}`}>
                <header>
                  <div>
                    <strong>{dayLabel(session.date, language)} · {session.startTime}–{session.endTime}</strong>
                    <span>{session.venueName}</span>
                  </div>
                  <div className="admin-overview-meta">
                    {session.status === 'draft' ? <span className="admin-pill">{c.draft}</span> : null}
                    {session.markedFull ? <span className="admin-pill">{c.full}</span> : null}
                    <span className="admin-pill strong">
                      {session.bookedSpots}/{session.capacity}
                    </span>
                  </div>
                </header>
                <RosterList roster={session.roster} language={language} />
                {session.roster.length ? <CopyRosterButton text={rosterText(session, session.roster)} language={language} /> : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
