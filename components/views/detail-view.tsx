'use client';

import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot.mjs';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.mjs';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.mjs';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.mjs';
import Share2 from 'lucide-react/dist/esm/icons/share-2.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';
import Timer from 'lucide-react/dist/esm/icons/timer.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';

import { Button } from '@/components/ui/button';
import { VenuePhoto } from '@/components/venue-photo';
import type { Venue } from '@/lib/demo-data';
import { formatDuration, formatLongDate, formatMoney, formatNames } from '@/lib/formatters';
import { venueFullLocation, venueMapsUrl } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { Language, Session } from '@/types/tennis';

export function DetailView({
  selectedSession,
  selectedVenue,
  language,
  t,
  shareNotice,
  onNavigateHome,
  onShareSession,
  onBeginBooking,
}: {
  selectedSession: Session;
  selectedVenue: Venue;
  language: Language;
  t: Translations;
  shareNotice: string;
  onNavigateHome: () => void;
  onShareSession: () => void;
  onBeginBooking: () => void;
}) {
  const spots = Math.max(0, selectedSession.capacity - selectedSession.bookedSpots);
  const full = spots === 0;
  const fullLocation = venueFullLocation(selectedVenue, language);

  return (
    <section className="detail-page page-width">
      <button type="button" className="back-link" onClick={onNavigateHome}>
        <ArrowLeft size={16} /> {t.back}
      </button>
      <div className="detail-layout">
        <div className="detail-visual">
          <VenuePhoto venue={selectedVenue} alt={`${selectedVenue.name} tennis court`} />
          <div className="detail-image-caption">
            <MapPin size={16} /> {selectedVenue.name} · {selectedVenue.area}
          </div>
        </div>
        <div className="detail-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" /> {t.sessionDetails}
          </p>
          <h1>{selectedVenue.name}</h1>
          <p className="detail-description">
            {language === 'zh' ? selectedSession.descriptionZh : selectedSession.description}
          </p>
          <div className="detail-facts">
            <div>
              <CalendarDays size={19} />
              <span>
                <small>{t.date}</small>
                <strong>{formatLongDate(selectedSession.date, language)}</strong>
              </span>
            </div>
            <div>
              <Clock3 size={19} />
              <span>
                <small>{t.time}</small>
                <strong>
                  {selectedSession.startTime}–{selectedSession.endTime} · {t.london}
                </strong>
              </span>
            </div>
            <div>
              <Timer size={19} />
              <span>
                <small>{t.duration}</small>
                <strong>{formatDuration(selectedSession.startTime, selectedSession.endTime, language)}</strong>
              </span>
            </div>
            <div>
              <CircleDot size={19} />
              <span>
                <small>{t.formats}</small>
                <strong>{formatNames(selectedSession.formats, t)}</strong>
              </span>
            </div>
            <div>
              <Users size={19} />
              <span>
                <small>{t.availability}</small>
                <strong>{full ? t.full : `${spots} ${spots === 1 ? t.spotLeft : t.spotsLeft}`}</strong>
              </span>
            </div>
            <div>
              <CreditCard size={19} />
              <span>
                <small>{t.pricePerPerson}</small>
                <strong>{formatMoney(selectedSession.pricePence, language)}</strong>
              </span>
            </div>
          </div>
          <div className="detail-note">
            <ShieldCheck size={18} />
            <span>
              {t.noLevelLimit}. {t.allLevels}.
            </span>
          </div>
          <div className="detail-location">
            <MapPin size={19} aria-hidden="true" />
            <div className="detail-location-copy">
              <small>{t.location}</small>
              <span>{fullLocation}</span>
            </div>
            <a href={venueMapsUrl(selectedVenue)} target="_blank" rel="noreferrer">
              {t.openInGoogleMaps}
            </a>
          </div>
          <div className="detail-actions">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="share-button"
              onClick={onShareSession}
            >
              <Share2 size={17} /> {t.shareSession}
            </Button>
            <Button size="lg" className="primary-wide" disabled={full} onClick={onBeginBooking}>
              {full ? t.full : t.bookNow}
              <ArrowRight size={17} />
            </Button>
          </div>
          {shareNotice ? (
            <p className="share-notice" role="status" aria-live="polite">
              {shareNotice}
            </p>
          ) : null}
        </div>
      </div>
      <div className="detail-about">
        <div>
          <p className="eyebrow muted">{t.aboutSession}</p>
          <h2>
            {language === 'zh'
              ? '认识球友，把时间留给球场。'
              : 'Meet a few players. Make time for the court.'}
          </h2>
        </div>
        <p>{language === 'zh' ? selectedSession.descriptionZh : selectedSession.description}</p>
      </div>
    </section>
  );
}
