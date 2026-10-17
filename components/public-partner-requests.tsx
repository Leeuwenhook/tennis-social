'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.mjs';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.mjs';
import RotateCw from 'lucide-react/dist/esm/icons/rotate-cw.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';

import { PartnerContactFields } from '@/components/partner-request-fields';
import { PREFERRED_SLOTS, SLOT_LABELS, slotLabels } from '@/lib/partner-request-slots';
import { formatDate, formatDuration } from '@/lib/formatters';
import { LEVELS } from '@/lib/tennis-utils';
import type { Language, PartnerRequestFormat, UserProfile } from '@/types/tennis';

type PublicRequest = {
  id: string;
  venueName: string;
  postcode: string;
  area: string;
  preferredDate: string | null;
  preferredSlots: string[];
  expiresOn: string;
  startTime: string | null;
  endTime: string | null;
  requestKind: string;
  existingPlayerLevels: string[];
  seekingPlayerCount: number;
  seekingLevels: string[];
  preferredFormat: PartnerRequestFormat;
  venueBookingStatus: 'booked' | 'not_booked' | 'unknown';
};

type ApplicationForm = {
  name: string;
  email: string;
  phone: string;
  wechat: string; whatsapp: string; preferredContact: 'email' | 'phone' | 'wechat' | 'whatsapp';
  tennisLevel: string;
  preferredFormat: PartnerRequestFormat;
  message: string;
};

type Filters = {
  area: string;
  date: string;
  slot: string;
  level: string;
  format: '' | PartnerRequestFormat;
};

type ApplicationState =
  | { kind: 'idle' | 'sending' | 'invalid' | 'duplicate' | 'closed' | 'error' }
  | { kind: 'sent'; id: string };

const copy = {
  en: {
    eyebrow: 'Public board',
    title: 'Open partner requests',
    intro:
      'Find players who are looking for a tennis partner. An application is reviewed before anyone shares contact details.',
    loading: 'Loading open requests…',
    unavailable: 'Open requests are temporarily unavailable. Please try again later.',
    retry: 'Retry',
    empty: 'No requests match these filters. Try changing one filter to see other open requests.',
    area: 'Area',
    date: 'Date',
    level: 'Level',
    format: 'Format',
    all: 'Any',
    allLevels: 'Any level',
    allFormats: 'Any format',
    clear: 'Clear filters',
    apply: 'Apply to join',
    existing: 'Already playing',
    seeking: 'Looking for',
    placesNeeded: (count: number) => `${count} ${count === 1 ? 'place' : 'places'} needed`,
    noPlaces: 'No places left',
    venue: 'Court status',
    booked: 'Court booked',
    notBooked: 'Court not booked',
    unknown: 'Court status unknown',
    flexible: 'Flexible',
    singles: 'Singles',
    doubles: 'Doubles',
    practice: 'Practice',
    formTitle: 'Apply to join',
    formIntro: 'Your application stays private and is sent to the request team for review.',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    preferredSlots: 'Preferred time slots', wechat: 'WeChat', whatsapp: 'WhatsApp', preferredContact: 'Preferred contact method', contactPrivacyNote: 'Contact details are shared with matched players only after review.',
    yourLevel: 'Your level',
    chooseLevel: 'Choose your level',
    message: 'Message',
    optional: 'optional',
    submit: 'Send application',
    submitting: 'Sending…',
    cancel: 'Cancel',
    done: 'Done',
    loginPrefill: 'Some fields were prefilled from your account.',
    sent: 'Application sent',
    pending: 'Pending — waiting for the organiser to review your application.',
    accepted: 'Accepted applications are confirmed by the organiser before contact details are shared.',
    reference: 'Application reference',
    duplicate: 'You have already applied to this request.',
    closed: 'This request is closed or full.',
    error: 'We could not send your application. Please check your details and try again.',
    required: 'Please complete your name, email, level and format.',
  },
  zh: {
    eyebrow: '公开需求',
    title: '正在找搭子',
    intro: '浏览正在找网球搭子的需求。申请会先审核，公开页面不会显示联系方式。',
    loading: '正在加载开放需求…',
    unavailable: '开放需求暂时不可用，请稍后重试。',
    retry: '重试',
    empty: '没有符合筛选条件的需求。可以调整筛选条件后再查看。',
    area: '区域',
    date: '日期',
    level: '水平',
    format: '形式',
    all: '不限',
    allLevels: '不限水平',
    allFormats: '不限形式',
    clear: '清除筛选',
    apply: '申请加入',
    existing: '已有球友',
    seeking: '希望水平',
    placesNeeded: (count: number) => `还缺 ${count} 个名额`,
    noPlaces: '名额已满',
    venue: '场地状态',
    booked: '场地已订',
    notBooked: '场地未订',
    unknown: '场地状态未知',
    flexible: '灵活',
    singles: '单打',
    doubles: '双打',
    practice: '练球',
    formTitle: '申请加入',
    formIntro: '申请仅发送给需求团队审核，不会公开。',
    name: '姓名',
    email: '邮箱',
    phone: '电话',
    preferredSlots: '偏好时间段', wechat: '微信', whatsapp: 'WhatsApp', preferredContact: '首选联系方式', contactPrivacyNote: '联系方式仅在审核后与匹配球友共享。',
    yourLevel: '你的水平',
    chooseLevel: '选择你的水平',
    message: '留言',
    optional: '可选',
    submit: '提交申请',
    submitting: '提交中…',
    cancel: '取消',
    done: '完成',
    loginPrefill: '已根据你的账号预填部分信息。',
    sent: '申请已提交',
    pending: '待审核——等待发起人审核你的申请。',
    accepted: '申请被接受后，发起人会确认详情并再分享联系方式。',
    reference: '申请编号',
    duplicate: '你已经申请过这个需求。',
    closed: '该需求已关闭或名额已满。',
    error: '申请提交失败，请检查信息后重试。',
    required: '请填写姓名、邮箱、水平和形式。',
  },
} as const;

type Copy = (typeof copy)[Language];

const FORMATS: PartnerRequestFormat[] = ['singles', 'doubles', 'practice', 'flexible'];
const EMPTY_FILTERS: Filters = { area: '', date: '', slot: '', level: '', format: '' };
const EMPTY_FORM: ApplicationForm = {
  name: '',
  email: '',
  phone: '', wechat: '', whatsapp: '', preferredContact: 'email',
  tennisLevel: '',
  preferredFormat: 'flexible',
  message: '',
};

function userFormat(user: UserProfile): PartnerRequestFormat {
  return user.preferredFormat === 'both' ? 'flexible' : user.preferredFormat;
}

/** Fill only the fields the applicant has not typed yet. */
function prefillFromUser(form: ApplicationForm, user: UserProfile): ApplicationForm {
  return {
    ...form,
    name: form.name || user.name,
    email: form.email || user.email,
    phone: form.phone || user.phone,
    tennisLevel: form.tennisLevel || user.tennisLevel,
  };
}

function errorState(code: string | undefined): ApplicationState {
  switch (code) {
    case 'duplicate_application':
      return { kind: 'duplicate' };
    case 'request_closed':
    case 'request_full':
    case 'not_found':
      return { kind: 'closed' };
    case 'invalid_request':
      return { kind: 'invalid' };
    default:
      return { kind: 'error' };
  }
}

function errorMessage(state: ApplicationState, t: Copy) {
  switch (state.kind) {
    case 'invalid':
      return t.required;
    case 'duplicate':
      return t.duplicate;
    case 'closed':
      return t.closed;
    case 'error':
      return t.error;
    default:
      return null;
  }
}

function venueStatusLabel(status: PublicRequest['venueBookingStatus'], t: Copy) {
  if (status === 'booked') return t.booked;
  if (status === 'not_booked') return t.notBooked;
  return t.unknown;
}

function RequestFilters({
  filters,
  areas,
  t,
  onChange,
  language,
}: {
  language: Language;
  filters: Filters;
  areas: string[];
  t: Copy;
  onChange: (filters: Filters) => void;
}) {
  return (
    <fieldset className="cs-pr-filters">
      <legend className="sr-only">{t.title}</legend>
      <label><span>{t.preferredSlots}</span><select value={filters.slot} onChange={(event) => onChange({ ...filters, slot: event.target.value })}><option value="">{t.all}</option>{PREFERRED_SLOTS.map((slot) => <option key={slot} value={slot}>{SLOT_LABELS[language][slot]}</option>)}</select></label>
      <label className="cs-pr-field">
        <span>{t.area}</span>
        <select value={filters.area} onChange={(event) => onChange({ ...filters, area: event.target.value })}>
          <option value="">{t.all}</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </label>
      <label className="cs-pr-field">
        <span>{t.date}</span>
        <input
          type="date"
          value={filters.date}
          onChange={(event) => onChange({ ...filters, date: event.target.value })}
        />
      </label>
      <label className="cs-pr-field">
        <span>{t.level}</span>
        <select value={filters.level} onChange={(event) => onChange({ ...filters, level: event.target.value })}>
          <option value="">{t.allLevels}</option>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <label className="cs-pr-field">
        <span>{t.format}</span>
        <select
          value={filters.format}
          onChange={(event) => onChange({ ...filters, format: event.target.value as Filters['format'] })}
        >
          <option value="">{t.allFormats}</option>
          {FORMATS.map((format) => (
            <option key={format} value={format}>
              {t[format]}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="cs-pr-btn ghost" onClick={() => onChange(EMPTY_FILTERS)}>
        {t.clear}
      </button>
    </fieldset>
  );
}

function RequestCard({
  request,
  language,
  t,
  onApply,
}: {
  request: PublicRequest;
  language: Language;
  t: Copy;
  onApply: (request: PublicRequest) => void;
}) {
  const hasPlaces = request.seekingPlayerCount > 0;
  return (
    <article className="cs-pr-card">
      <div className="cs-pr-card-head">
        <div>
          <p className="cs-pr-area">{request.area || request.postcode}</p>
          <h3>
            <MapPin size={15} aria-hidden="true" />
            {request.venueName || request.postcode}
          </h3>
        </div>
        <span className={hasPlaces ? 'cs-pr-places' : 'cs-pr-places none'}>
          <Users size={14} aria-hidden="true" />
          {hasPlaces ? t.placesNeeded(request.seekingPlayerCount) : t.noPlaces}
        </span>
      </div>
      <div className="cs-pr-meta">
        <span>
          <CalendarDays size={14} aria-hidden="true" />
          {request.preferredDate ? formatDate(request.preferredDate, language) : slotLabels(request.preferredSlots, language)}
        </span>
        <span>
          <Clock3 size={14} aria-hidden="true" />
          {request.startTime && request.endTime ? `${request.startTime}–${request.endTime}` : ''} · {request.startTime && request.endTime ? formatDuration(request.startTime, request.endTime, language) : ''}
        </span>
      </div>
      <dl className="cs-pr-details">
        <div>
          <dt>{t.existing}</dt>
          <dd>{request.existingPlayerLevels.join(', ') || t.allLevels}</dd>
        </div>
        <div>
          <dt>{t.seeking}</dt>
          <dd>{request.seekingLevels.join(', ') || t.allLevels}</dd>
        </div>
        <div>
          <dt>{t.format}</dt>
          <dd>{t[request.preferredFormat]}</dd>
        </div>
        <div>
          <dt>{t.venue}</dt>
          <dd>{venueStatusLabel(request.venueBookingStatus, t)}</dd>
        </div>
      </dl>
      {hasPlaces ? (
        <button type="button" className="cs-pr-btn primary" onClick={() => onApply(request)}>
          {t.apply}
        </button>
      ) : null}
    </article>
  );
}

function ApplicationDialog({
  request,
  form,
  state,
  prefilled,
  t,
  onChange,
  onSubmit,
  onDismiss,
}: {
  request: PublicRequest;
  form: ApplicationForm;
  state: ApplicationState;
  prefilled: boolean;
  t: Copy;
  onChange: (form: ApplicationForm) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const sending = state.kind === 'sending';
  const sent = state.kind === 'sent';
  const message = errorMessage(state, t);

  // Open as a real modal so focus is trapped, the page is inert and Escape works.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // The submit button disappears on success; keep focus inside the dialog.
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  return (
    <dialog
      ref={dialogRef}
      className="cs-pr-dialog"
      aria-labelledby="partner-application-title"
      onCancel={(event) => {
        if (sending) event.preventDefault();
      }}
      onClose={onDismiss}
    >
      <h2 id="partner-application-title">{sent ? t.sent : t.formTitle}</h2>
      <p className="cs-pr-dialog-sub">
        {request.venueName || request.postcode} · {request.startTime && request.endTime ? `${request.startTime}–${request.endTime}` : ''}
      </p>
      {state.kind === 'sent' ? (
        <>
          <p>{t.pending}</p>
          <p>
            <strong>{t.reference}:</strong> <span className="cs-digits">{state.id}</span>
          </p>
          <p className="cs-pr-note">{t.accepted}</p>
          <div className="cs-pr-dialog-actions">
            <button ref={doneRef} type="button" className="cs-pr-btn primary" onClick={onDismiss}>
              {t.done}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="cs-pr-note">{t.formIntro}</p>
          {prefilled ? <p className="cs-pr-note">{t.loginPrefill}</p> : null}
          <form className="cs-pr-form" onSubmit={onSubmit} noValidate>
            <label className="cs-pr-field">
              <span>{t.name}</span>
              <input
                value={form.name}
                autoComplete="name"
                onChange={(event) => onChange({ ...form, name: event.target.value })}
                required
              />
            </label>
            <label className="cs-pr-field">
              <span>{t.email}</span>
              <input
                type="email"
                value={form.email}
                autoComplete="email"
                onChange={(event) => onChange({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label className="cs-pr-field">
              <span>
                {t.phone} ({t.optional})
              </span>
              <input
                type="tel"
                required={form.preferredContact === 'phone'} value={form.phone}
                autoComplete="tel"
                onChange={(event) => onChange({ ...form, phone: event.target.value })}
              />
            </label>
            <div className="cs-pr-form-row">
              <label className="cs-pr-field">
                <span>{t.yourLevel}</span>
                <select
                  value={form.tennisLevel}
                  onChange={(event) => onChange({ ...form, tennisLevel: event.target.value })}
                  required
                >
                  <option value="">{t.chooseLevel}</option>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <PartnerContactFields value={form} labels={t} onChange={(contacts) => onChange({ ...form, ...contacts })} />
              <label className="cs-pr-field">
                <span>{t.format}</span>
                <select
                  value={form.preferredFormat}
                  onChange={(event) =>
                    onChange({ ...form, preferredFormat: event.target.value as PartnerRequestFormat })
                  }
                >
                  {FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {t[format]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="cs-pr-field">
              <span>
                {t.message} ({t.optional})
              </span>
              <textarea
                value={form.message}
                onChange={(event) => onChange({ ...form, message: event.target.value })}
              />
            </label>
            {message ? (
              <p className="cs-pr-error" role="alert">
                {message}
              </p>
            ) : null}
            <div className="cs-pr-dialog-actions">
              <button type="button" className="cs-pr-btn ghost" onClick={onDismiss} disabled={sending}>
                {t.cancel}
              </button>
              <button type="submit" className="cs-pr-btn primary" disabled={sending}>
                {sending ? t.submitting : t.submit}
              </button>
            </div>
          </form>
        </>
      )}
    </dialog>
  );
}

export function PublicPartnerRequests({ language }: { language: Language }) {
  const t = copy[language];
  const [requests, setRequests] = useState<PublicRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applicationRequest, setApplicationRequest] = useState<PublicRequest | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM);
  const [applicationState, setApplicationState] = useState<ApplicationState>({ kind: 'idle' });
  const lastRequestIdRef = useRef<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reservation-requests', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const data = (await response.json()) as { requests?: PublicRequest[] };
        if (!cancelled) setRequests(Array.isArray(data.requests) ? data.requests : []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { user?: UserProfile };
        const sessionUser = data.user;
        if (cancelled || !sessionUser) return;
        setUser(sessionUser);
        setForm((current) => prefillFromUser(current, sessionUser));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const areas = useMemo(
    () => [...new Set(requests.map((request) => request.area).filter(Boolean))].sort(),
    [requests],
  );

  const visibleRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (filters.area && request.area !== filters.area) return false;
        if (filters.slot && !request.preferredSlots.includes(filters.slot)) return false;
        if (filters.date && request.preferredDate !== filters.date) return false;
        if (filters.format && request.preferredFormat !== filters.format) return false;
        if (filters.level && ![...request.existingPlayerLevels, ...request.seekingLevels].includes(filters.level)) {
          return false;
        }
        return true;
      }),
    [filters, requests],
  );

  function retry() {
    setLoading(true);
    setLoadError(false);
    setReloadKey((key) => key + 1);
  }

  const openApplication = useCallback(
    (request: PublicRequest) => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const isNewRequest = lastRequestIdRef.current !== request.id;
      lastRequestIdRef.current = request.id;
      setApplicationRequest(request);
      setApplicationState({ kind: 'idle' });
      setForm((current) => {
        const base = isNewRequest
          ? {
              ...current,
              message: '',
              preferredFormat: user ? userFormat(user) : current.preferredFormat,
            }
          : current;
        return user ? prefillFromUser(base, user) : base;
      });
    },
    [user],
  );

  const closeApplication = useCallback(() => {
    setApplicationRequest(null);
    returnFocusRef.current?.focus();
    returnFocusRef.current = null;
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applicationRequest) return;
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email) || !form.tennisLevel || !form.preferredFormat) {
      setApplicationState({ kind: 'invalid' });
      return;
    }
    setApplicationState({ kind: 'sending' });
    try {
      const response = await fetch(
        `/api/reservation-requests/${encodeURIComponent(applicationRequest.id)}/applications`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        application?: { id?: string };
        error?: string;
      };
      if (response.ok && data.application?.id) {
        setApplicationState({ kind: 'sent', id: data.application.id });
        // A sent application clears the draft so the next request starts fresh.
        lastRequestIdRef.current = null;
      } else {
        setApplicationState(errorState(data.error));
      }
    } catch {
      setApplicationState({ kind: 'error' });
    }
  }

  return (
    <section className="cs-pr page-width" aria-labelledby="partner-requests-title">
      <div className="cs-schedule-head">
        <div>
          <p className="cs-kicker muted">{t.eyebrow}</p>
          <h2 id="partner-requests-title">{t.title}</h2>
          <p>{t.intro}</p>
        </div>
      </div>

      <RequestFilters language={language} filters={filters} areas={areas} t={t} onChange={setFilters} />

      {loading ? (
        <div className="cs-empty">{t.loading}</div>
      ) : loadError ? (
        <div className="cs-empty cs-pr-unavailable">
          <p>{t.unavailable}</p>
          <button type="button" className="cs-pr-btn ghost" onClick={retry}>
            <RotateCw size={15} aria-hidden="true" />
            {t.retry}
          </button>
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="cs-empty">{t.empty}</div>
      ) : (
        <div className="cs-pr-grid">
          {visibleRequests.map((request) => (
            <RequestCard key={request.id} request={request} language={language} t={t} onApply={openApplication} />
          ))}
        </div>
      )}

      {applicationRequest ? (
        <ApplicationDialog
          request={applicationRequest}
          form={form}
          state={applicationState}
          prefilled={Boolean(user)}
          t={t}
          onChange={setForm}
          onSubmit={submit}
          onDismiss={closeApplication}
        />
      ) : null}
    </section>
  );
}
