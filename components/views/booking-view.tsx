'use client';

import type { FormEvent } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot.mjs';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';

import { QuantityControl } from '@/components/quantity-control';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VenuePhoto } from '@/components/venue-photo';
import { RACKET_PRICE_PENCE, type GameFormat, type Venue } from '@/lib/demo-data';
import { formatDate, formatMoney, formatNames } from '@/lib/formatters';
import { LEVELS } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type {
  BookingStage,
  Coupon,
  Language,
  LoyaltyStatus,
  Session,
  UserProfile,
  View,
} from '@/types/tennis';

export type BookingFormState = {
  name: string;
  email: string;
  phone: string;
  participants: string[];
  format: GameFormat | '';
  racketCount: number;
  includeFriends: boolean;
};

export function BookingView({
  bookingStage,
  selectedSession,
  selectedVenue,
  bookingForm,
  setBookingForm,
  formErrors,
  setFormErrors,
  user,
  loyalty,
  availableCoupons,
  selectedCoupon,
  selectedCouponId,
  setSelectedCouponId,
  paymentFailed,
  paymentCancelled,
  checkoutLoading,
  adjustmentNotice,
  loyaltyDiscountPence,
  couponDiscountPence,
  permanentDiscountPercent,
  totalPence,
  language,
  t,
  onNavigate,
  onOpenSignup,
  onToggleFriends,
  onUpdateGroupSize,
  onUpdateParticipant,
  onContinueToPayment,
  onCompletePayment,
}: {
  bookingStage: BookingStage;
  selectedSession: Session;
  selectedVenue: Venue;
  bookingForm: BookingFormState;
  setBookingForm: React.Dispatch<React.SetStateAction<BookingFormState>>;
  formErrors: Record<string, string>;
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  user: UserProfile | null;
  loyalty: LoyaltyStatus | null;
  availableCoupons: Coupon[];
  selectedCoupon: Coupon | null;
  selectedCouponId: string;
  setSelectedCouponId: (id: string) => void;
  paymentFailed: boolean;
  paymentCancelled: boolean;
  checkoutLoading: boolean;
  adjustmentNotice: string;
  loyaltyDiscountPence: number;
  couponDiscountPence: number;
  permanentDiscountPercent: number;
  totalPence: number;
  language: Language;
  t: Translations;
  onNavigate: (view: View, options?: { sessionId?: string | null; bookingStage?: BookingStage }) => void;
  onOpenSignup: (prefill: { name: string; email: string; phone: string }) => void;
  onToggleFriends: (enabled: boolean) => void;
  onUpdateGroupSize: (size: number) => void;
  onUpdateParticipant: (index: number, level: string) => void;
  onContinueToPayment: (e: FormEvent<HTMLFormElement>) => void;
  onCompletePayment: () => void;
}) {
  function renderProgress() {
    return (
      <div className="booking-progress" aria-label="Booking progress">
        <span className={bookingStage === 'details' ? 'current' : 'done'}>
          <b>{bookingStage === 'details' ? '1' : <Check size={13} />}</b>
          {t.contactDetails}
        </span>
        <i />
        <span className={bookingStage === 'payment' ? 'current' : ''}>
          <b>2</b>
          {t.payment}
        </span>
      </div>
    );
  }

  function renderSummary() {
    return (
      <aside className="order-summary">
        <div className="summary-image">
          <VenuePhoto venue={selectedVenue} alt="" />
        </div>
        <div className="summary-content">
          <p className="eyebrow muted">{t.orderSummary}</p>
          <h3>{selectedVenue.name}</h3>
          <p className="summary-date">
            <CalendarDays size={15} /> {formatDate(selectedSession.date, language)} ·{' '}
            {selectedSession.startTime}–{selectedSession.endTime}
          </p>
          <p className="summary-format">
            <CircleDot size={15} /> {t.format}:{' '}
            {bookingForm.format ? formatNames([bookingForm.format], t) : ''}
          </p>
          <div className="summary-lines">
            <div>
              <span>
                {t.sessionFee} × {bookingForm.participants.length}
              </span>
              <strong>
                {formatMoney(selectedSession.pricePence * bookingForm.participants.length, language)}
              </strong>
            </div>
            {loyaltyDiscountPence ? (
              <div className="summary-discount">
                <span>
                  {t.loyaltyDiscount} ({permanentDiscountPercent}%)
                </span>
                <strong>−{formatMoney(loyaltyDiscountPence, language)}</strong>
              </div>
            ) : null}
            {selectedCoupon && couponDiscountPence ? (
              <div className="summary-discount">
                <span>
                  {t.couponDiscount} ({selectedCoupon.discountPercent}%)
                </span>
                <strong>−{formatMoney(couponDiscountPence, language)}</strong>
              </div>
            ) : null}
            <div>
              <span>
                {t.racketFee} × {bookingForm.racketCount}
              </span>
              <strong>{formatMoney(bookingForm.racketCount * RACKET_PRICE_PENCE, language)}</strong>
            </div>
          </div>
          <div className="summary-total">
            <span>{t.total}</span>
            <strong>{formatMoney(totalPence, language)}</strong>
          </div>
          <p className="summary-notice">
            <ShieldCheck size={15} /> {t.demoNotice}
          </p>
        </div>
      </aside>
    );
  }

  if (bookingStage === 'payment') {
    return (
      <section className="booking-page page-width">
        <button
          type="button"
          className="back-link"
          onClick={() => onNavigate('booking', { bookingStage: 'details' })}
        >
          <ArrowLeft size={16} /> {t.contactDetails}
        </button>
        {renderProgress()}
        <div className="booking-layout payment-layout">
          <div className="payment-panel">
            <p className="eyebrow">
              <span className="eyebrow-dot" /> {t.payment}
            </p>
            <h1>{t.demoPayment}</h1>
            <p className="form-intro">{t.paymentIntro}</p>
            <div className="demo-payment-card">
              <div className="demo-card-icon">
                <CreditCard size={24} />
              </div>
              <div>
                <strong>{t.demoPayment}</strong>
                <span>{t.demoPaymentIntro}</span>
              </div>
              <Badge variant="secondary">STRIPE</Badge>
            </div>
            {user && loyalty?.legacyCouponsEnabled && availableCoupons.length ? (
              <div className="coupon-picker field">
                <Label htmlFor="booking-coupon">{t.applyCoupon}</Label>
                <select
                  id="booking-coupon"
                  className="native-select"
                  value={selectedCouponId}
                  onChange={(event) => setSelectedCouponId(event.target.value)}
                >
                  <option value="">{t.noCoupon}</option>
                  {availableCoupons.map((coupon) => (
                    <option key={coupon.id} value={coupon.id}>
                      {coupon.code} · {coupon.discountPercent}% ·{' '}
                      {t.couponExpires.replace(
                        '{date}',
                        formatDate(coupon.expiresAt.slice(0, 10), language),
                      )}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {paymentFailed || paymentCancelled ? (
              <div className="inline-error">
                <TriangleAlert size={16} />{' '}
                {paymentCancelled ? t.paymentCancelled : t.paymentFailed}
              </div>
            ) : null}
            <div className="payment-actions">
              <Button
                size="lg"
                className="primary-wide"
                disabled={checkoutLoading}
                onClick={onCompletePayment}
              >
                {checkoutLoading
                  ? language === 'zh'
                    ? '正在打开安全付款…'
                    : 'Opening secure checkout…'
                  : t.simulateSuccess}
                <ArrowRight size={17} />
              </Button>
            </div>
          </div>
          {renderSummary()}
        </div>
      </section>
    );
  }

  return (
    <section className="booking-page page-width">
      <button type="button" className="back-link" onClick={() => onNavigate('detail')}>
        <ArrowLeft size={16} /> {t.back}
      </button>
      {renderProgress()}
      <div className="booking-layout">
        <form className="booking-form" onSubmit={onContinueToPayment} noValidate>
          <p className="eyebrow">
            <span className="eyebrow-dot" /> {t.bookYourPlace}
          </p>
          <h1>{t.contactDetails}</h1>
          <p className="form-intro">{t.contactIntro}</p>
          {user ? (
            <p className="profile-prefill-notice">
              <Check size={15} /> {t.signedInPrefill}
            </p>
          ) : null}
          <div className="form-grid two-col">
            <div className="field">
              <Label htmlFor="name">
                {t.name} <em>*</em>
              </Label>
              <Input
                id="name"
                value={bookingForm.name}
                onChange={(event) =>
                  setBookingForm((current) => ({ ...current, name: event.target.value }))
                }
                autoComplete="name"
              />
            </div>
            <div className="field">
              <Label htmlFor="email">
                {t.email} <em>*</em>
              </Label>
              <Input
                id="email"
                inputMode="email"
                value={bookingForm.email}
                onChange={(event) =>
                  setBookingForm((current) => ({ ...current, email: event.target.value }))
                }
                autoComplete="email"
              />
            </div>
          </div>
          <div className="field">
            <Label htmlFor="phone">
              {t.phone} <small>({t.optional})</small>
            </Label>
            <Input
              id="phone"
              inputMode="tel"
              value={bookingForm.phone}
              onChange={(event) =>
                setBookingForm((current) => ({ ...current, phone: event.target.value }))
              }
              autoComplete="tel"
            />
          </div>
          {formErrors.contact || formErrors.email ? (
            <div className="inline-error">
              <TriangleAlert size={16} /> {formErrors.contact || formErrors.email}
            </div>
          ) : null}
          {!user ? (
            <div className="signup-prompt">
              <span>{t.saveInfoPrompt}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onOpenSignup({
                    name: bookingForm.name,
                    email: bookingForm.email,
                    phone: bookingForm.phone,
                  })
                }
              >
                {t.createAccount}
              </Button>
            </div>
          ) : null}
          <div className="form-divider" />
          <div className="format-selection">
            <div className="form-section-heading">
              <div>
                <h2>{t.format}</h2>
                <p>{t.availableFormats}</p>
              </div>
            </div>
            <div className="format-options" role="radiogroup" aria-label={t.format}>
              {selectedSession.formats.map((format) => (
                <label
                  className={`format-option${bookingForm.format === format ? ' selected' : ''}`}
                  key={format}
                >
                  <input
                    type="radio"
                    name="session-format"
                    value={format}
                    checked={bookingForm.format === format}
                    onChange={() => {
                      setBookingForm((current) => ({ ...current, format }));
                      setFormErrors((current) => ({ ...current, format: '' }));
                    }}
                  />
                  <span>{formatNames([format], t)}</span>
                </label>
              ))}
            </div>
          </div>
          {formErrors.format ? (
            <div className="inline-error">
              <TriangleAlert size={16} /> {formErrors.format}
            </div>
          ) : null}
          <div className="form-divider" />
          <div className="form-section-heading">
            <div>
              <h2>{t.participants}</h2>
              <p>{t.allLevels}</p>
            </div>
            <div className="participant-controls">
              <label className="friends-toggle">
                <input
                  type="checkbox"
                  checked={bookingForm.includeFriends}
                  disabled={selectedSession.capacity - selectedSession.bookedSpots < 2}
                  onChange={(event) => onToggleFriends(event.target.checked)}
                />
                <span>{t.addFriends}</span>
              </label>
              {bookingForm.includeFriends ? (
                <QuantityControl
                  label={t.groupSize}
                  value={bookingForm.participants.length}
                  min={1}
                  max={selectedSession.capacity - selectedSession.bookedSpots}
                  onChange={onUpdateGroupSize}
                />
              ) : (
                <span className="single-person-count">1 {t.person}</span>
              )}
            </div>
          </div>
          <div className="level-list">
            {bookingForm.participants.map((level, index) => (
              <div className="field" key={`${index}-${bookingForm.participants.length}`}>
                <Label htmlFor={`level-${index}`}>
                  {index === 0 ? t.yourLevel : `${t.friendLevel} ${index}`} <em>*</em>
                </Label>
                <select
                  id={`level-${index}`}
                  value={level}
                  onChange={(event) => onUpdateParticipant(index, event.target.value)}
                  className="native-select"
                >
                  <option value="">{language === 'zh' ? '请选择水平' : 'Select level'}</option>
                  {LEVELS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {adjustmentNotice ? (
            <p className="adjustment-notice">
              <TriangleAlert size={15} /> {adjustmentNotice}
            </p>
          ) : null}
          {formErrors.participants ? (
            <div className="inline-error">
              <TriangleAlert size={16} /> {formErrors.participants}
            </div>
          ) : null}
          <div className="form-divider" />
          <div className="form-section-heading">
            <div>
              <h2>{t.rental}</h2>
              <p>{t.rentalIntro}</p>
            </div>
            <QuantityControl
              label={t.rental}
              value={bookingForm.racketCount}
              min={0}
              max={bookingForm.participants.length}
              onChange={(value) => {
                setBookingForm((current) => ({ ...current, racketCount: value }));
              }}
            />
          </div>
          <div className="rental-hint">
            <span>
              {bookingForm.racketCount}{' '}
              {bookingForm.racketCount === 1 ? t.racket : t.rackets}
            </span>
            <span>{formatMoney(bookingForm.racketCount * RACKET_PRICE_PENCE, language)}</span>
          </div>
          <Button size="lg" className="primary-wide form-submit" type="submit">
            {t.continuePayment}
            <ArrowRight size={17} />
          </Button>
        </form>
        {renderSummary()}
      </div>
    </section>
  );
}
