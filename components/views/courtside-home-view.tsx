'use client';

import { useId, useMemo, useState } from 'react';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right.mjs';
import CalendarPlus from 'lucide-react/dist/esm/icons/calendar-plus.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.mjs';
import Timer from 'lucide-react/dist/esm/icons/timer.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';

import { VenuePhoto } from '@/components/venue-photo';
import type { GameFormat, Venue } from '@/lib/demo-data';
import { formatMoney, formatNames, sessionDurationBadge } from '@/lib/formatters';
import { getVenue, sessionMatchPreferences, venueLocationSummary } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { Booking, Language, Session } from '@/types/tennis';

type FormatFilter = 'all' | GameFormat;

const copy = {
  en: {
    nextUp: 'Next on court',
    liveBoard: 'Live board',
    spotsOpen: 'spots open',
    sessions: 'Sessions',
    venues: 'Venues',
    openSpots: 'Open spots',
    from: 'From',
    orderOfPlay: 'Order of play',
    all: 'All',
    noMatches: 'No sessions match this filter yet.',
    today: 'Today',
    tomorrow: 'Tomorrow',
    perPerson: 'pp',
    serveTitle: 'Your serve.',
    serveText: 'Got a court in mind, or need partners at your level? Tell us and we will set the match.',
    sessionOne: 'session',
  },
  zh: {
    nextUp: '下一场',
    liveBoard: '实时看板',
    spotsOpen: '个空位',
    sessions: '场次',
    venues: '球场',
    openSpots: '剩余名额',
    from: '最低',
    orderOfPlay: '赛程表',
    all: '全部',
    noMatches: '暂时没有符合筛选条件的场次。',
    today: '今天',
    tomorrow: '明天',
    perPerson: '/人',
    serveTitle: '轮到你发球。',
    serveText: '有想去的球场，或想找水平相近的球友？告诉我们，我们来安排。',
    sessionOne: '场次',
  },
} as const;

function dateParts(date: string, language: Language) {
  const value = new Date(`${date}T12:00:00`);
  const locale = language === 'zh' ? 'zh-CN' : 'en-GB';
  return {
    day: String(value.getDate()).padStart(2, '0'),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(value),
    month: new Intl.DateTimeFormat(locale, { month: 'short' }).format(value),
    long: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(value),
  };
}

function relativeDayLabel(date: string, language: Language) {
  const today = new Date();
  const toKey = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date === toKey(today)) return copy[language].today;
  if (date === toKey(tomorrow)) return copy[language].tomorrow;
  return null;
}

function CourtLines() {
  return (
    <svg className="cs-court-lines" viewBox="0 0 400 220" preserveAspectRatio="none" aria-hidden="true">
      <rect x="10" y="10" width="380" height="200" />
      <line x1="10" y1="35" x2="390" y2="35" />
      <line x1="10" y1="185" x2="390" y2="185" />
      <line x1="200" y1="10" x2="200" y2="210" className="cs-net" />
      <line x1="105" y1="35" x2="105" y2="185" />
      <line x1="295" y1="35" x2="295" y2="185" />
      <line x1="105" y1="110" x2="295" y2="110" />
      <line x1="10" y1="110" x2="18" y2="110" />
      <line x1="382" y1="110" x2="390" y2="110" />
    </svg>
  );
}

/**
 * A tennis ball with its two curved seams. The seams spin inside a fixed
 * highlight, so the ball reads as rotating under a steady light.
 */
function TennisBall({ className }: { className: string }) {
  const clipId = `cs-ball-clip-${useId().replace(/:/g, '')}`;
  return (
    <span className={`cs-tennis-ball ${className}`} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <defs>
          <clipPath id={clipId}>
            <circle cx="20" cy="20" r="19" />
          </clipPath>
        </defs>
        <circle cx="20" cy="20" r="19" className="cs-ball-felt" />
        <g clipPath={`url(#${clipId})`}>
          <g className="cs-ball-seams">
            <path d="M6 3 C 17 12, 17 28, 6 37" className="cs-ball-groove" />
            <path d="M34 3 C 23 12, 23 28, 34 37" className="cs-ball-groove" />
            <path d="M6 3 C 17 12, 17 28, 6 37" className="cs-ball-seam" />
            <path d="M34 3 C 23 12, 23 28, 34 37" className="cs-ball-seam" />
          </g>
        </g>
        <circle cx="20" cy="20" r="19" className="cs-ball-shade" />
      </svg>
    </span>
  );
}

function SpotMeter({ capacity, booked }: { capacity: number; booked: number }) {
  const total = Math.min(capacity, 12);
  const filled = Math.round((Math.min(booked, capacity) / Math.max(capacity, 1)) * total);
  return (
    <span className="cs-meter" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={index < filled ? 'taken' : ''} />
      ))}
    </span>
  );
}

export function CourtsideHomeView({
  upcomingSessions,
  sessionsReady,
  venueList,
  bookings,
  language,
  t,
  onOpenSession,
  onOpenReservationRequest,
  onScrollToSessions,
}: {
  upcomingSessions: Session[];
  sessionsReady: boolean;
  venueList: Venue[];
  bookings: Booking[];
  language: Language;
  t: Translations;
  onOpenSession: (id: string) => void;
  onOpenReservationRequest: () => void;
  onScrollToSessions: () => void;
}) {
  const c = copy[language];
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');

  const nextSession = upcomingSessions.find((session) => session.capacity > session.bookedSpots) ?? upcomingSessions[0];
  const nextVenue = nextSession ? getVenue(nextSession.venueId, venueList) : null;

  const stats = useMemo(() => {
    const openSpots = upcomingSessions.reduce(
      (total, session) => total + Math.max(0, session.capacity - session.bookedSpots),
      0,
    );
    const venueCount = new Set(upcomingSessions.map((session) => session.venueId)).size;
    const lowestPrice = upcomingSessions.length
      ? Math.min(...upcomingSessions.map((session) => session.pricePence))
      : null;
    return { openSpots, venueCount, lowestPrice };
  }, [upcomingSessions]);

  const groupedSessions = useMemo(() => {
    const filtered = upcomingSessions.filter(
      (session) => formatFilter === 'all' || session.formats.includes(formatFilter),
    );
    const groups = new Map<string, Session[]>();
    for (const session of filtered) {
      groups.set(session.date, [...(groups.get(session.date) ?? []), session]);
    }
    return [...groups.entries()];
  }, [upcomingSessions, formatFilter]);

  function sessionRow(session: Session, index: number) {
    const venue = getVenue(session.venueId, venueList);
    const spots = Math.max(0, session.capacity - session.bookedSpots);
    const isFull = spots === 0;
    const matchPreferences = sessionMatchPreferences(session, bookings);
    const durationBadge = sessionDurationBadge(session.startTime, session.endTime, language);

    return (
      <article
        className={`cs-row ${isFull ? 'is-full' : ''}`}
        key={session.id}
        style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      >
        <button
          type="button"
          className="cs-row-hit"
          aria-label={`${isFull ? t.viewDetails : t.bookNow}: ${venue.name}, ${session.startTime}`}
          onClick={() => onOpenSession(session.id)}
        />
        <div className="cs-row-time">
          <strong>{session.startTime}</strong>
          <small>{session.endTime}</small>
        </div>
        <div className="cs-row-photo">
          <VenuePhoto venue={venue} alt={`${venue.name} tennis court`} controls={false} />
        </div>
        <div className="cs-row-main">
          <p className="cs-row-area">{language === 'zh' ? venue.areaZh || venue.area : venue.area}</p>
          <h3>{venue.name}</h3>
          <p className="cs-row-location">
            <MapPin size={12} aria-hidden="true" />
            <span>{venueLocationSummary(venue, language)}</span>
          </p>
          <div className="cs-row-tags">
            {durationBadge ? (
              <span className="cs-tag duration">
                <Timer size={12} aria-hidden="true" />
                {durationBadge}
              </span>
            ) : null}
            {session.formats.map((format) => (
              <span key={format} className="cs-tag">
                {formatNames([format], t)}
              </span>
            ))}
          </div>
          {matchPreferences.length ? (
            <div className="cs-match" aria-label={t.lookingFor}>
              <span className="cs-match-label">
                <Users size={13} aria-hidden="true" />
                {t.lookingFor}
              </span>
              <ul>
                {matchPreferences.map((preference) => (
                  <li key={`${preference.level}-${preference.format}`}>
                    {t.lookingForLevel
                      .replace('{level}', preference.level)
                      .replace('{format}', formatNames([preference.format], t))}
                    {preference.count > 1 ? <b> ×{preference.count}</b> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="cs-row-spots">
          <SpotMeter capacity={session.capacity} booked={session.bookedSpots} />
          <span className={isFull ? 'full' : spots === 1 ? 'urgent' : ''}>
            {isFull ? t.full : `${spots} ${spots === 1 ? t.spotLeft : t.spotsLeft}`}
          </span>
        </div>
        <div className="cs-row-price">
          <strong>{formatMoney(session.pricePence, language)}</strong>
          <small>{c.perPerson}</small>
        </div>
        <span className="cs-row-cta" aria-hidden="true">
          <span>{isFull ? t.viewDetails : t.bookNow}</span>
          <ArrowUpRight size={16} />
        </span>
      </article>
    );
  }

  return (
    <div className="courtside">
      <section className="cs-hero">
        <div className="cs-hero-court">
          <CourtLines />
          <span className="cs-ball">
            <TennisBall className="spinning" />
          </span>
        </div>
        <div className="cs-hero-inner page-width">
          <div className="cs-hero-copy">
            <p className="cs-kicker">
              <span className="cs-kicker-dot" /> {t.eyebrow}
            </p>
            <h1>{t.headline}</h1>
            <p className="cs-hero-text">{t.intro}</p>
            <ul className="cs-hero-points">
              <li>
                <Check size={15} aria-hidden="true" /> {t.allLevels}
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> {t.courtReady}
              </li>
            </ul>
            <div className="cs-hero-actions">
              <button type="button" className="cs-btn primary request" onClick={onOpenReservationRequest}>
                <span className="cs-btn-icon">
                  <CalendarPlus size={19} />
                </span>
                <span className="cs-btn-copy">
                  <strong>{t.requestCta}</strong>
                  <small>{t.requestCtaHint}</small>
                </span>
                <ArrowRight size={18} />
              </button>
              <button type="button" className="cs-btn ghost" onClick={onScrollToSessions}>
                {t.exploreSessions}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          <aside className="cs-board" aria-label={c.nextUp}>
            <header>
              <span>{c.nextUp}</span>
              <span className="cs-live">
                <i /> {c.liveBoard}
              </span>
            </header>
            {nextSession && nextVenue ? (
              <button type="button" className="cs-board-body" onClick={() => onOpenSession(nextSession.id)}>
                <div className="cs-board-photo">
                  <VenuePhoto venue={nextVenue} alt={`${nextVenue.name} tennis court`} controls={false} />
                </div>
                <div className="cs-board-grid">
                  <div>
                    <small>{dateParts(nextSession.date, language).weekday}</small>
                    <strong className="cs-digits">{dateParts(nextSession.date, language).day}</strong>
                    <small>{dateParts(nextSession.date, language).month}</small>
                  </div>
                  <div>
                    <small>{t.time}</small>
                    <strong className="cs-digits">{nextSession.startTime}</strong>
                    <small>→ {nextSession.endTime}</small>
                    {sessionDurationBadge(nextSession.startTime, nextSession.endTime, language) ? (
                      <em className="cs-board-duration">
                        {sessionDurationBadge(nextSession.startTime, nextSession.endTime, language)}
                      </em>
                    ) : null}
                  </div>
                  <div>
                    <small>{c.openSpots}</small>
                    <strong className="cs-digits accent">
                      {Math.max(0, nextSession.capacity - nextSession.bookedSpots)}
                    </strong>
                    <small>/ {nextSession.capacity}</small>
                  </div>
                </div>
                <div className="cs-board-footer">
                  <span>
                    <strong>{nextVenue.name}</strong>
                    <small>{language === 'zh' ? nextVenue.areaZh || nextVenue.area : nextVenue.area}</small>
                  </span>
                  <span className="cs-board-go">
                    {nextSession.capacity > nextSession.bookedSpots ? t.bookNow : t.viewDetails}{' '}
                    <ArrowRight size={15} />
                  </span>
                </div>
              </button>
            ) : (
              <div className="cs-board-empty">{sessionsReady ? t.emptyBookings : t.loadingSessions}</div>
            )}
          </aside>
        </div>

        <dl className="cs-stats page-width">
          <div>
            <dt>{c.sessions}</dt>
            <dd className="cs-digits">{sessionsReady ? upcomingSessions.length : '–'}</dd>
          </div>
          <div>
            <dt>{c.venues}</dt>
            <dd className="cs-digits">{sessionsReady ? stats.venueCount : '–'}</dd>
          </div>
          <div>
            <dt>{c.openSpots}</dt>
            <dd className="cs-digits">{sessionsReady ? stats.openSpots : '–'}</dd>
          </div>
          <div>
            <dt>{c.from}</dt>
            <dd className="cs-digits">
              {sessionsReady && stats.lowestPrice !== null ? formatMoney(stats.lowestPrice, language) : '–'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="cs-schedule page-width" id="sessions">
        <div className="cs-schedule-head">
          <div>
            <p className="cs-kicker muted">
              {c.orderOfPlay} · {t.london}
            </p>
            <h2>{t.upcoming}</h2>
            <p>{t.upcomingIntro}</p>
          </div>
          <fieldset className="cs-filter">
            <legend className="sr-only">{t.formats}</legend>
            {(['all', 'singles', 'doubles'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={formatFilter === value}
                onClick={() => setFormatFilter(value)}
              >
                {value === 'all' ? c.all : formatNames([value], t)}
              </button>
            ))}
          </fieldset>
        </div>

        {!sessionsReady ? (
          <div className="cs-empty">{t.loadingSessions}</div>
        ) : !upcomingSessions.length ? (
          <div className="cs-empty">{t.emptyBookings}</div>
        ) : !groupedSessions.length ? (
          <div className="cs-empty">{c.noMatches}</div>
        ) : (
          <div className="cs-days">
            {groupedSessions.map(([date, daySessions]) => {
              const parts = dateParts(date, language);
              const relative = relativeDayLabel(date, language);
              return (
                <section className="cs-day" key={date} aria-label={parts.long}>
                  <header className="cs-day-label">
                    <span className="cs-day-num cs-digits">{parts.day}</span>
                    <span>
                      <strong>{relative ?? parts.weekday}</strong>
                      <small>
                        {parts.month} · {daySessions.length} {daySessions.length === 1 ? c.sessionOne : c.sessions.toLowerCase()}
                      </small>
                    </span>
                  </header>
                  <div className="cs-day-rows">{daySessions.map(sessionRow)}</div>
                </section>
              );
            })}
          </div>
        )}

        <button type="button" className="cs-serve" onClick={onOpenReservationRequest}>
          <TennisBall className="cs-serve-ball" />
          <span className="cs-serve-copy">
            <strong>{c.serveTitle}</strong>
            <span>{c.serveText}</span>
          </span>
          <span className="cs-serve-cta">
            {t.requestCta}
            <ArrowRight size={17} />
          </span>
        </button>
      </section>
    </div>
  );
}
