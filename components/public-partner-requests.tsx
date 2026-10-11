'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, MapPin, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Language, PartnerRequestFormat, UserProfile } from '@/types/tennis';

type PublicRequest = {
  id: string;
  venueName: string;
  postcode: string;
  area: string;
  preferredDate: string;
  startTime: string;
  endTime: string;
  requestKind: string;
  existingPlayerLevels: string[];
  seekingPlayerCount: number;
  seekingLevels: string[];
  preferredFormat: PartnerRequestFormat;
  fullDurationRequired: boolean;
  venueBookingStatus: 'booked' | 'not_booked' | 'unknown';
};

type ApplicationForm = {
  name: string;
  email: string;
  phone: string;
  tennisLevel: string;
  preferredFormat: PartnerRequestFormat;
  canAttendFullDuration: boolean;
  message: string;
};

const copy = {
  en: {
    title: 'Open partner requests', intro: 'Find players who are looking for a tennis partner. An application is reviewed before anyone shares contact details.',
    loading: 'Loading open requests…', unavailable: 'Open requests are temporarily unavailable. Please try again later.', empty: 'No requests match these filters. Try changing one filter to see other open requests.',
    area: 'Area', date: 'Date', level: 'Level', format: 'Format', full: 'Full duration only', all: 'Any', allDates: 'Any date', allLevels: 'Any level', allFormats: 'Any format', clear: 'Clear filters', apply: 'Apply to join',
    location: 'Location', time: 'Time', duration: 'Duration', existing: 'Already playing', seeking: 'Looking for', missing: 'places needed', venue: 'Court status', booked: 'Court booked', notBooked: 'Court not booked', unknown: 'Court status unknown', flexible: 'Flexible', singles: 'Singles', doubles: 'Doubles', practice: 'Practice',
    formTitle: 'Apply to join', formIntro: 'Your application stays private and is sent to the request team for review.', name: 'Name', email: 'Email', phone: 'Phone', yourLevel: 'Your level', canAttend: 'I can attend the full duration', message: 'Message', optional: 'optional', submit: 'Send application', submitting: 'Sending…', cancel: 'Cancel', loginPrefill: 'Some fields were prefilled from your account.',
    sent: 'Application sent', pending: 'Pending — waiting for the organiser to review your application.', accepted: 'Accepted applications are confirmed by the organiser before contact details are shared.', reference: 'Application reference', duplicate: 'You have already applied to this request.', closed: 'This request is closed or full.', error: 'We could not send your application. Please check your details and try again.', required: 'Please complete your name, email, level and format.',
  },
  zh: {
    title: '正在找搭子', intro: '浏览正在找网球搭子的需求。申请会先审核，公开页面不会显示联系方式。', loading: '正在加载开放需求…', unavailable: '开放需求暂时不可用，请稍后重试。', empty: '没有符合筛选条件的需求。可以调整筛选条件后再查看。',
    area: '区域', date: '日期', level: '水平', format: '形式', full: '只看必须全程参加', all: '不限', allDates: '不限日期', allLevels: '不限水平', allFormats: '不限形式', clear: '清除筛选', apply: '申请加入',
    location: '地点', time: '时间', duration: '时长', existing: '已有球友', seeking: '希望水平', missing: '个名额', venue: '场地状态', booked: '场地已订', notBooked: '场地未订', unknown: '场地状态未知', flexible: '灵活', singles: '单打', doubles: '双打', practice: '练球',
    formTitle: '申请加入', formIntro: '申请仅发送给需求团队审核，不会公开。', name: '姓名', email: '邮箱', phone: '电话', yourLevel: '你的水平', canAttend: '我可以全程参加', message: '留言', optional: '可选', submit: '提交申请', submitting: '提交中…', cancel: '取消', loginPrefill: '已根据你的账号预填部分信息。',
    sent: '申请已提交', pending: '待审核——等待发起人审核你的申请。', accepted: '申请被接受后，发起人会确认详情并再分享联系方式。', reference: '申请编号', duplicate: '你已经申请过这个需求。', closed: '该需求已关闭或名额已满。', error: '申请提交失败，请检查信息后重试。', required: '请填写姓名、邮箱、水平和形式。',
  },
} as const;

const levels = ['2.0', '2.5', '3.0', '3.5', '4.0', '4.5'];
const formats: PartnerRequestFormat[] = ['singles', 'doubles', 'practice', 'flexible'];

function duration(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number);
  const minutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
}

export function PublicPartnerRequests({ language }: { language: Language }) {
  const t = copy[language];
  const [requests, setRequests] = useState<PublicRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState({ area: '', date: '', level: '', format: '', full: false });
  const [applicationRequest, setApplicationRequest] = useState<PublicRequest | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ApplicationForm>({ name: '', email: '', phone: '', tennisLevel: '', preferredFormat: 'flexible', canAttendFullDuration: false, message: '' });
  const [applicationState, setApplicationState] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'duplicate' | 'closed' | 'error'; id?: string }>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reservation-requests', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json() as { requests?: PublicRequest[] };
      if (!cancelled) setRequests(Array.isArray(data.requests) ? data.requests : []);
    }).catch(() => { if (!cancelled) setLoadError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const areas = useMemo(() => [...new Set(requests.map((request) => request.area).filter(Boolean))].sort(), [requests]);
  const visibleRequests = useMemo(() => requests.filter((request) => {
    if (filters.area && request.area !== filters.area) return false;
    if (filters.date && request.preferredDate !== filters.date) return false;
    if (filters.format && request.preferredFormat !== filters.format) return false;
    if (filters.level && ![...request.existingPlayerLevels, ...request.seekingLevels].includes(filters.level)) return false;
    if (filters.full && !request.fullDurationRequired) return false;
    return true;
  }), [filters, requests]);

  function openApplication(request: PublicRequest) {
    setApplicationRequest(request); setApplicationState({ kind: 'idle' });
    setForm((current) => ({ ...current, name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', tennisLevel: user?.tennisLevel ?? '', preferredFormat: user?.preferredFormat === 'both' ? 'flexible' : user?.preferredFormat ?? 'flexible' }));
    if (!user) fetch('/api/auth/session', { cache: 'no-store' }).then(async (response) => { if (!response.ok) return; const data = await response.json() as { user?: UserProfile }; if (data.user) { setUser(data.user); setForm((current) => ({ ...current, name: current.name || data.user?.name || '', email: current.email || data.user?.email || '', phone: current.phone || data.user?.phone || '', tennisLevel: current.tennisLevel || data.user?.tennisLevel || '' })); } }).catch(() => undefined);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!applicationRequest) return;
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email) || !form.tennisLevel || !form.preferredFormat) { setApplicationState({ kind: 'error' }); return; }
    setApplicationState({ kind: 'sending' });
    try {
      const response = await fetch(`/api/reservation-requests/${encodeURIComponent(applicationRequest.id)}/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json() as { application?: { id?: string }; error?: string };
      if (response.ok && data.application?.id) setApplicationState({ kind: 'sent', id: data.application.id });
      else if (data.error === 'duplicate_application') setApplicationState({ kind: 'duplicate' });
      else if (data.error === 'request_closed') setApplicationState({ kind: 'closed' });
      else setApplicationState({ kind: 'error' });
    } catch { setApplicationState({ kind: 'error' }); }
  }

  const formatLabel = (format: PartnerRequestFormat) => t[format];
  return <section className="partner-requests-section page-width" aria-labelledby="partner-requests-title">
    <div className="section-heading"><div><p className="eyebrow muted">{language === 'zh' ? '公开需求' : 'PUBLIC BOARD'}</p><h2 id="partner-requests-title">{t.title}</h2><p>{t.intro}</p></div></div>
    <div className="partner-request-filters" role="group" aria-label={t.title}>
      <label>{t.area}<select value={filters.area} onChange={(event) => setFilters({ ...filters, area: event.target.value })}><option value="">{t.all}</option>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
      <label>{t.date}<Input type="date" value={filters.date} onChange={(event) => setFilters({ ...filters, date: event.target.value })} /></label>
      <label>{t.level}<select value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value })}><option value="">{t.allLevels}</option>{levels.map((level) => <option key={level}>{level}</option>)}</select></label>
      <label>{t.format}<select value={filters.format} onChange={(event) => setFilters({ ...filters, format: event.target.value })}><option value="">{t.allFormats}</option>{formats.map((format) => <option key={format} value={format}>{formatLabel(format)}</option>)}</select></label>
      <label className="partner-request-check"><input type="checkbox" checked={filters.full} onChange={(event) => setFilters({ ...filters, full: event.target.checked })} /> {t.full}</label>
      <Button type="button" variant="ghost" onClick={() => setFilters({ area: '', date: '', level: '', format: '', full: false })}>{t.clear}</Button>
    </div>
    {loading ? <div className="empty-state">{t.loading}</div> : loadError ? <div className="empty-state">{t.unavailable}</div> : visibleRequests.length === 0 ? <div className="empty-state">{t.empty}</div> : <div className="partner-request-grid">
      {visibleRequests.map((request) => <article className="partner-request-card" key={request.id}><div className="partner-request-card-heading"><div><p className="eyebrow muted">{request.area || request.postcode}</p><h3><MapPin size={15} /> {request.venueName || request.postcode}</h3></div><span className="partner-request-missing"><Users size={14} /> {request.seekingPlayerCount} {t.missing}</span></div><div className="partner-request-meta"><span><CalendarDays size={14} /> {request.preferredDate}</span><span><Clock3 size={14} /> {request.startTime}–{request.endTime} · {duration(request.startTime, request.endTime)}</span></div><dl className="partner-request-details"><div><dt>{t.existing}</dt><dd>{request.existingPlayerLevels.join(', ') || t.allLevels}</dd></div><div><dt>{t.seeking}</dt><dd>{request.seekingLevels.join(', ') || t.allLevels}</dd></div><div><dt>{t.format}</dt><dd>{formatLabel(request.preferredFormat)}</dd></div><div><dt>{t.venue}</dt><dd>{request.venueBookingStatus === 'booked' ? t.booked : request.venueBookingStatus === 'not_booked' ? t.notBooked : t.unknown}</dd></div></dl><Button type="button" onClick={() => openApplication(request)}>{t.apply}</Button></article>)}
    </div>}
    {applicationRequest ? <div className="partner-request-dialog" role="dialog" aria-modal="true" aria-labelledby="partner-application-title"><div className="partner-request-dialog-panel"><h2 id="partner-application-title">{applicationState.kind === 'sent' ? t.sent : t.formTitle}</h2>{applicationState.kind === 'sent' ? <><p>{t.pending}</p><p><strong>{t.reference}:</strong> {applicationState.id}</p><p className="partner-request-status-note">{t.accepted}</p><Button type="button" onClick={() => setApplicationRequest(null)}>{t.cancel}</Button></> : <><p>{t.formIntro}</p>{user ? <p className="partner-request-prefill">{t.loginPrefill}</p> : null}<form onSubmit={submit}><label>{t.name}<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>{t.email}<Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label>{t.phone} ({t.optional})<Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>{t.yourLevel}<select value={form.tennisLevel} onChange={(event) => setForm({ ...form, tennisLevel: event.target.value })} required><option value="">{t.allLevels}</option>{levels.map((level) => <option key={level}>{level}</option>)}</select></label><label>{t.format}<select value={form.preferredFormat} onChange={(event) => setForm({ ...form, preferredFormat: event.target.value as PartnerRequestFormat })}>{formats.map((format) => <option key={format} value={format}>{formatLabel(format)}</option>)}</select></label><label className="partner-request-check"><input type="checkbox" checked={form.canAttendFullDuration} onChange={(event) => setForm({ ...form, canAttendFullDuration: event.target.checked })} /> {t.canAttend}</label><label>{t.message} ({t.optional})<textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>{applicationState.kind === 'duplicate' ? <p className="partner-request-error">{t.duplicate}</p> : applicationState.kind === 'closed' ? <p className="partner-request-error">{t.closed}</p> : applicationState.kind === 'error' ? <p className="partner-request-error">{t.error}</p> : null}<div className="partner-request-dialog-actions"><Button type="button" variant="outline" onClick={() => setApplicationRequest(null)}>{t.cancel}</Button><Button type="submit" disabled={applicationState.kind === 'sending'}>{applicationState.kind === 'sending' ? t.submitting : t.submit}</Button></div></form></>}</div></div> : null}
  </section>;
}
