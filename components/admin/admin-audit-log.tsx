'use client';

import { useEffect, useState } from 'react';
import Undo2 from 'lucide-react/dist/esm/icons/undo-2.mjs';

import { Button } from '@/components/ui/button';
import type { Language } from '@/types/tennis';

type Change = { field: string; before: unknown; after: unknown };

type AuditEntry = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  changes: Change[];
  undoneAt: string | null;
  undoneBy: string | null;
  undoable: boolean;
};

const TARGETS = ['auth', 'session', 'venue', 'booking', 'request', 'application', 'review', 'settings', 'import'] as const;

const copy = {
  en: {
    eyebrow: 'History',
    title: 'Admin activity',
    intro: 'Every change made in the admin, newest first. Session edits and venue edits can be undone if nothing has changed them since. Deletes, refunds and cancellations cannot be undone.',
    all: 'Everything',
    targets: { auth: 'Logins', session: 'Sessions', venue: 'Venues', booking: 'Bookings', request: 'Partner requests', application: 'Applications', review: 'Reviews', settings: 'Settings', import: 'Imports' },
    actions: {
      'auth.login.success': 'Login succeeded', 'auth.login.failed': 'Login failed',
      'session.create': 'Created session', 'session.update': 'Edited session', 'session.delete': 'Deleted session',
      'sessions.import': 'Imported sessions', 'venue.create': 'Added venue', 'venue.update': 'Edited venue', 'venue.delete': 'Deleted venue',
      'booking.cancel': 'Cancelled booking', 'booking.refund': 'Cancelled and refunded booking', 'request.create': 'Created partner request', 'request.status': 'Changed request status',
      'application.status': 'Changed application status', 'review.moderate': 'Moderated review', 'review.delete': 'Deleted review',
      'settings.update': 'Changed settings', undo: 'Undo',
    } as Record<string, string>,
    undo: 'Undo',
    undone: 'Undone by {actor} · {time}',
    confirmUndo: 'Restore this to how it was before the change?',
    loadMore: 'Load more',
    empty: 'No activity yet.',
    error: 'Activity could not be loaded.',
    undoErrors: {
      changed_since: 'It has been changed again since, so this change cannot be undone on its own.',
      locked_fields: 'The session now has bookings, so its venue, date, time and price cannot be changed back.',
      capacity_too_low: 'More players have booked than the earlier capacity allows.',
      has_bookings: 'Someone has booked this session, so it cannot be removed.',
      already_undone: 'This change was already undone.',
    } as Record<string, string>,
    undoFailed: 'The change could not be undone.',
  },
  zh: {
    eyebrow: '记录',
    title: '操作记录',
    intro: '后台的每一次修改，按时间倒序。场次编辑和场地编辑，在之后没有再被修改的情况下可以撤销；删除、退款和取消不能撤销。',
    all: '全部',
    targets: { auth: '登录', session: '场次', venue: '场地', booking: '预订', request: '找球友需求', application: '加入申请', review: '评价', settings: '设置', import: '导入' },
    actions: {
      'auth.login.success': '登录成功', 'auth.login.failed': '登录失败',
      'session.create': '新建场次', 'session.update': '修改场次', 'session.delete': '删除场次',
      'sessions.import': '导入场次', 'venue.create': '新增场地', 'venue.update': '修改场地', 'venue.delete': '删除场地',
      'booking.cancel': '取消预订', 'booking.refund': '取消并退款', 'request.create': '代建找球友需求', 'request.status': '修改需求状态',
      'application.status': '修改申请状态', 'review.moderate': '审核评价', 'review.delete': '删除评价',
      'settings.update': '修改设置', undo: '撤销',
    } as Record<string, string>,
    undo: '撤销',
    undone: '已由 {actor} 撤销 · {time}',
    confirmUndo: '恢复到这次修改之前的状态？',
    loadMore: '加载更多',
    empty: '还没有操作记录。',
    error: '操作记录加载失败。',
    undoErrors: {
      changed_since: '之后又被修改过，不能单独撤销这一次。',
      locked_fields: '场次现在已有报名，场地、日期、时间和价格不能改回去。',
      capacity_too_low: '已报名人数超过了修改前的名额。',
      has_bookings: '这个场次已有人报名，不能删除。',
      already_undone: '这次修改已经撤销过了。',
    } as Record<string, string>,
    undoFailed: '撤销失败。',
  },
} as const;

function timeLabel(iso: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  }).format(new Date(iso));
}

/** An undo's summary is "Undid <action>: <summary>"; show the action by its translated name. */
function summaryLabel(entry: AuditEntry, actions: Record<string, string>) {
  const match = entry.action === 'undo' ? /^(?:Undid )?([\w.]+): ([\s\S]*)$/.exec(entry.summary) : null;
  return match ? `${actions[match[1]] ?? match[1]} · ${match[2]}` : entry.summary;
}

function valueLabel(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && value.startsWith('data:')) return '(image)';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function AdminAuditLog({ language, onChanged }: { language: Language; onChanged: () => void }) {
  const c = copy[language];
  const [target, setTarget] = useState('');
  const [entries, setEntries] = useState<{ key: string; list: AuditEntry[]; nextOffset: number | null; nextCursor: string | null } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const key = `${target}|${reloadKey}`;
  const error = errorKey === key;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(target ? { targetType: target } : {});
    fetch(`/api/admin/audit?${params.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const body = (await response.json()) as { entries: AuditEntry[]; nextOffset: number | null; nextCursor: string | null };
        if (!cancelled) {
          setEntries({ key: `${target}|${reloadKey}`, list: body.entries, nextOffset: body.nextOffset, nextCursor: body.nextCursor });
          setErrorKey(null);
        }
      })
      .catch(() => {
        if (!cancelled) setErrorKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [target, reloadKey, key]);

  async function loadMore() {
    if (entries?.nextOffset == null || entries.key !== key) return;
    const offset = entries.nextOffset;
    try {
      const response = await fetch(`/api/admin/audit?${new URLSearchParams({ offset: String(offset), ...(entries.nextCursor ? { cursor: entries.nextCursor } : {}), ...(target ? { targetType: target } : {}) })}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const body = (await response.json()) as { entries: AuditEntry[]; nextOffset: number | null; nextCursor: string | null };
      setEntries((current) => current?.key === key && current.nextOffset === offset
        ? { key: key, list: [...current.list, ...body.entries], nextOffset: body.nextOffset, nextCursor: body.nextCursor } : current);
    } catch {
      setErrorKey(key);
    }
  }

  async function undo(entry: AuditEntry) {
    if (!window.confirm(c.confirmUndo)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/audit/${encodeURIComponent(entry.id)}/undo`, { method: 'POST' });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok) {
        setReloadKey((value) => value + 1);
        onChanged();
      } else {
        setMessage((body.error && c.undoErrors[body.error]) || c.undoFailed);
      }
    } catch {
      setMessage(c.undoFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-audit">
      <div className="admin-list-heading">
        <div>
          <p className="eyebrow muted">{c.eyebrow}</p>
          <h2>{c.title}</h2>
          <p>{c.intro}</p>
        </div>
      </div>
      <div className="admin-filter-bar">
        <select className="native-select" aria-label={c.title} value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="">{c.all}</option>
          {TARGETS.map((value) => (
            <option key={value} value={value}>{c.targets[value]}</option>
          ))}
        </select>
      </div>
      {message ? <p className="admin-error" role="alert">{message}</p> : null}
      {error ? <div className="empty-state">{c.error}</div> : null}
      {entries && !entries.list.length ? <div className="empty-state">{c.empty}</div> : null}
      <ol className="admin-audit-list">
        {(entries?.key === key ? entries.list : []).map((entry) => (
          <li key={entry.id} className={entry.undoneAt ? 'is-undone' : ''}>
            <div className="admin-audit-head">
              <strong>{c.actions[entry.action] ?? entry.action}</strong>
              <span>{summaryLabel(entry, c.actions)}</span>
              <small>{entry.actor} · {timeLabel(entry.createdAt, language)}</small>
            </div>
            {entry.changes.length ? (
              <ul className="admin-audit-changes">
                {entry.changes.map((change) => (
                  <li key={change.field}>
                    <code>{change.field}</code> {valueLabel(change.before)} → {valueLabel(change.after)}
                  </li>
                ))}
              </ul>
            ) : null}
            {entry.undoneAt ? (
              <small className="admin-audit-undone">
                {c.undone.replace('{actor}', entry.undoneBy ?? '').replace('{time}', timeLabel(entry.undoneAt, language))}
              </small>
            ) : entry.undoable ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void undo(entry)}>
                <Undo2 size={14} /> {c.undo}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>
      {entries?.key === key && entries.nextOffset != null ? (
        <Button size="sm" variant="outline" onClick={() => void loadMore()}>{c.loadMore}</Button>
      ) : null}
    </div>
  );
}
