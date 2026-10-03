'use client';

import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot.mjs';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';

import { Button } from '@/components/ui/button';
import { RACKET_PRICE_PENCE, type Venue } from '@/lib/demo-data';
import { formatLongDate, formatMoney, formatNames } from '@/lib/formatters';
import { getVenue } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { Booking, ConfirmationEmailStatus, Language, Session, UserProfile } from '@/types/tennis';

export function ConfirmationView({
  confirmation,
  sessions,
  venueList,
  user,
  confirmationEmailStatus,
  language,
  t,
  onNavigateHome,
  onOpenSignup,
}: {
  confirmation: Booking;
  sessions: Session[];
  venueList: Venue[];
  user: UserProfile | null;
  confirmationEmailStatus: ConfirmationEmailStatus;
  language: Language;
  t: Translations;
  onNavigateHome: () => void;
  onOpenSignup: (prefill: { name: string; email: string; phone: string }) => void;
}) {
  const session = sessions.find((item) => item.id === confirmation.sessionId);
  if (!session) return null;
  const venue = getVenue(session.venueId, venueList);

  return (
    <section className="confirmation-page page-width">
      <div className="confirmation-card">
        <div className="success-icon">
          <Check size={28} strokeWidth={3} />
        </div>
        <p className="eyebrow">
          <span className="eyebrow-dot" /> {t.confirmed}
        </p>
        <h1>{t.confirmed}</h1>
        <p className="confirmation-intro">{t.confirmationIntro}</p>
        <div className="reference-box">
          <span>{t.bookingReference}</span>
          <strong>{confirmation.id}</strong>
        </div>
        <div className="confirmation-details">
          <div>
            <img src={venue.photo} alt="" />
            <span>
              <small>{t.location}</small>
              <strong>{venue.name}</strong>
            </span>
          </div>
          <div>
            <CalendarDays size={18} />
            <span>
              <small>{t.date}</small>
              <strong>{formatLongDate(session.date, language)}</strong>
            </span>
          </div>
          <div>
            <CircleDot size={18} />
            <span>
              <small>{t.format}</small>
              <strong>{formatNames([confirmation.format], t)}</strong>
            </span>
          </div>
          <div>
            <Users size={18} />
            <span>
              <small>{t.participants}</small>
              <strong>
                {confirmation.participants.length}{' '}
                {confirmation.participants.length === 1 ? t.person : t.people}
              </strong>
            </span>
          </div>
          <div>
            <CreditCard size={18} />
            <span>
              <small>{t.rental}</small>
              <strong>
                {confirmation.racketCount}{' '}
                {confirmation.racketCount === 1 ? t.racket : t.rackets}
              </strong>
            </span>
          </div>
          <div>
            <CreditCard size={18} />
            <span>
              <small>{t.total}</small>
              <strong>{formatMoney(confirmation.totalPence, language)}</strong>
            </span>
          </div>
        </div>
        <div className="participant-chips">
          {confirmation.participants.map((level, index) => (
            <span key={`${level}-${index}`}>
              {index === 0 ? t.name : `${t.friendLevel} ${index}`} · {level}
            </span>
          ))}
        </div>
        <div className="confirmation-fee-breakdown" aria-label={t.orderSummary}>
          <div>
            <span>
              {t.sessionFee} × {confirmation.participants.length}
            </span>
            <strong>
              {formatMoney(session.pricePence * confirmation.participants.length, language)}
            </strong>
          </div>
          {confirmation.loyaltyDiscountPence ? (
            <div className="summary-discount">
              <span>
                {t.loyaltyDiscount} ({confirmation.loyaltyDiscountPercent || 10}%)
              </span>
              <strong>−{formatMoney(confirmation.loyaltyDiscountPence, language)}</strong>
            </div>
          ) : null}
          {confirmation.couponDiscountPence ? (
            <div className="summary-discount">
              <span>{t.couponDiscount}</span>
              <strong>−{formatMoney(confirmation.couponDiscountPence, language)}</strong>
            </div>
          ) : null}
          <div>
            <span>
              {t.racketFee} × {confirmation.racketCount}
            </span>
            <strong>{formatMoney(confirmation.racketCount * RACKET_PRICE_PENCE, language)}</strong>
          </div>
          <div>
            <span>{t.total}</span>
            <strong>{formatMoney(confirmation.totalPence, language)}</strong>
          </div>
        </div>
        {confirmationEmailStatus === 'sent' ? (
          <p className="confirmation-notice">
            <CalendarDays size={15} /> {t.emailConfirmationSent} <strong>{confirmation.email}</strong>.
          </p>
        ) : null}
        {confirmationEmailStatus === 'in_progress' ? (
          <p className="confirmation-notice">
            <CalendarDays size={15} /> {t.emailConfirmationPending}
          </p>
        ) : null}
        {confirmationEmailStatus === 'skipped' ? (
          <p className="confirmation-notice">
            <TriangleAlert size={15} /> {t.emailConfirmationSkipped}
          </p>
        ) : null}
        {confirmationEmailStatus === 'failed' ? (
          <p className="confirmation-notice">
            <TriangleAlert size={15} /> {t.emailConfirmationFailed}
          </p>
        ) : null}
        <p className="confirmation-notice">
          <ShieldCheck size={15} /> {t.demoNotice}
        </p>
        {!user ? (
          <div className="signup-prompt confirmation-signup-prompt">
            <span>{t.manageBookingPrompt}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onOpenSignup({
                  name: confirmation.contactName,
                  email: confirmation.email,
                  phone: confirmation.phone,
                })
              }
            >
              {t.createAccount}
            </Button>
          </div>
        ) : null}
        <Button size="lg" className="primary-wide" onClick={onNavigateHome}>
          {t.browseMore}
          <ArrowRight size={17} />
        </Button>
      </div>
    </section>
  );
}
