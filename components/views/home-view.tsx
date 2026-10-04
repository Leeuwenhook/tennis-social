'use client';

import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import CalendarPlus from 'lucide-react/dist/esm/icons/calendar-plus.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.mjs';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';

import { Button } from '@/components/ui/button';
import { VenuePhoto } from '@/components/venue-photo';
import type { Venue } from '@/lib/demo-data';
import { formatDate, formatMoney, formatNames } from '@/lib/formatters';
import {
  bookingPreferencesFromBookings,
  getVenue,
  summarizeBookingPreferences,
  venueLocationSummary,
} from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { Booking, Language, Session } from '@/types/tennis';

function sessionDurationBadge(session: Session, language: Language) {
  const [startHours, startMinutes] = session.startTime.split(':').map(Number);
  const [endHours, endMinutes] = session.endTime.split(':').map(Number);
  const durationMinutes = Math.max(0, (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes));
  if (durationMinutes < 120) return null;
  const hours = String(Number((durationMinutes / 60).toFixed(2)));
  return language === 'zh' ? `${hours}小时场` : `${hours}h session`;
}

export function HomeView({
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
  function sessionCard(session: Session) {
    const venue = getVenue(session.venueId, venueList);
    const spots = Math.max(0, session.capacity - session.bookedSpots);
    const isFull = spots === 0;
    const preferences = summarizeBookingPreferences(
      session.bookingPreferences ?? bookingPreferencesFromBookings(session.id, bookings),
    );
    const manualPreferences = (session.seekingLevels ?? []).flatMap((level) =>
      session.formats.map((format) => ({ level, format, count: 1 })),
    );
    const displayedPreferences = [...manualPreferences, ...preferences].filter(
      (preference, index, list) =>
        list.findIndex((item) => item.level === preference.level && item.format === preference.format) === index,
    );
    const durationBadge = sessionDurationBadge(session, language);

    return (
      <article className="session-card" key={session.id}>
        <button type="button" className="session-card-image" onClick={() => onOpenSession(session.id)}>
          <VenuePhoto venue={venue} alt={`${venue.name} tennis court`} controls={false} />
          <span className="image-overlay" />
          <span className="date-pill">
            <strong>{new Date(`${session.date}T12:00:00`).getDate()}</strong>
            <small>
              {new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { month: 'short' }).format(
                new Date(`${session.date}T12:00:00`),
              )}
            </small>
          </span>
          {isFull ? <span className="full-pill">{t.full}</span> : null}
          {durationBadge ? <span className="duration-pill">{durationBadge}</span> : null}
        </button>
        <div className="session-card-body">
          <div className="session-card-heading">
            <div>
              <p className="eyebrow muted">{venue.area}</p>
              <h3>{venue.name}</h3>
              <p className="session-location-summary">
                <MapPin size={13} aria-hidden="true" />
                <span>{venueLocationSummary(venue, language)}</span>
              </p>
            </div>
            <span className="session-price">
              {formatMoney(session.pricePence, language)}
              <small>/ {language === 'zh' ? '人' : 'person'}</small>
            </span>
          </div>
          <div className="session-meta-row">
            <span>
              <CalendarDays size={15} /> {formatDate(session.date, language)}
            </span>
            <span>
              <Clock3 size={15} /> {session.startTime}–{session.endTime}
            </span>
          </div>
          <div className="session-format-tags" aria-label={t.formats}>
            {session.formats.map((format) => (
              <span key={format}>{formatNames([format], t)}</span>
            ))}
          </div>
          {displayedPreferences.length ? (
            <div className="session-seeking" aria-label={t.lookingFor}>
              <Users size={15} />
              <div>
                <small>{t.lookingFor}</small>
                <div className="session-seeking-list">
                  {displayedPreferences.map((preference) => (
                    <span key={`${preference.level}-${preference.format}`}>
                      {t.lookingForLevel
                        .replace('{level}', preference.level)
                        .replace('{format}', formatNames([preference.format], t))}
                      {preference.count > 1 ? ` ×${preference.count}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <div className="session-card-footer">
            <span className={isFull ? 'spots full' : spots === 1 ? 'spots urgent' : 'spots'}>
              <Users size={15} /> {isFull ? t.full : `${spots} ${spots === 1 ? t.spotLeft : t.spotsLeft}`}
            </span>
            <Button
              variant={isFull ? 'outline' : 'default'}
              disabled={isFull}
              onClick={() => onOpenSession(session.id)}
            >
              {isFull ? t.viewDetails : t.bookNow}
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <section className="home-intro page-width">
        <div className="intro-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" /> {t.eyebrow}
          </p>
          <h1>{t.headline}</h1>
          <p className="intro-text">{t.intro}</p>
          <div className="intro-tags">
            <span>
              <Check size={15} /> {t.allLevels}
            </span>
            <span>
              <Check size={15} /> {t.courtReady}
            </span>
          </div>
          <button type="button" className="request-cta" onClick={onOpenReservationRequest}>
            <span className="request-cta-icon">
              <CalendarPlus size={19} />
            </span>
            <span>
              <strong>{t.requestCta}</strong>
              <small>{t.requestCtaHint}</small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button type="button" className="explore-cta" onClick={onScrollToSessions}>
            {t.exploreSessions}
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="intro-photo-grid" aria-label="London tennis courts">
          <img className="intro-photo-large" src="/venues/victoria-park.jpg" alt="Victoria Park tennis court" />
          <img className="intro-photo-small top" src="/venues/bethnal-green.jpg" alt="Bethnal Green tennis court" />
          <img className="intro-photo-small bottom" src="/venues/vauxhall-park.jpg" alt="Vauxhall Park tennis court" />
          <span className="intro-sticker">
            PLAY<br />
            <i>more</i>
          </span>
        </div>
      </section>
      <section className="sessions-section page-width" id="sessions">
        <div className="section-heading">
          <div>
            <p className="eyebrow muted">{t.london}</p>
            <h2>{t.upcoming}</h2>
            <p>{t.upcomingIntro}</p>
          </div>
          <span className="session-count">
            {sessionsReady
              ? `${upcomingSessions.length} ${
                  language === 'zh'
                    ? '场可报名'
                    : upcomingSessions.length === 1
                      ? 'session available'
                      : 'sessions available'
                }`
              : t.loadingSessions}
          </span>
        </div>
        <div className="session-grid">
          {!sessionsReady ? (
            <div className="empty-state">{t.loadingSessions}</div>
          ) : upcomingSessions.length ? (
            upcomingSessions.map(sessionCard)
          ) : (
            <div className="empty-state">{t.emptyBookings}</div>
          )}
        </div>
      </section>
    </>
  );
}
