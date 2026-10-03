'use client';

import type { FormEvent, KeyboardEvent } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarPlus from 'lucide-react/dist/esm/icons/calendar-plus.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Venue } from '@/lib/demo-data';
import { formatLongDate } from '@/lib/formatters';
import { dateFromToday, getVenue, venueLabel } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { Language, ReservationRequest, ReservationRequestForm, UserProfile } from '@/types/tennis';

export function RequestView({
  submittedRequest,
  requestForm,
  setRequestForm,
  requestBusy,
  requestError,
  requestVenueOpen,
  setRequestVenueOpen,
  requestVenueActiveIndex,
  requestVenueSuggestions,
  venueList,
  user,
  language,
  t,
  onSubmit,
  onNavigateHome,
  onOpenSignup,
  onUpdateVenueName,
  onSelectVenue,
  onKeyDown,
}: {
  submittedRequest: ReservationRequest | null;
  requestForm: ReservationRequestForm;
  setRequestForm: React.Dispatch<React.SetStateAction<ReservationRequestForm>>;
  requestBusy: boolean;
  requestError: string;
  requestVenueOpen: boolean;
  setRequestVenueOpen: (open: boolean) => void;
  requestVenueActiveIndex: number;
  requestVenueSuggestions: Venue[];
  venueList: Venue[];
  user: UserProfile | null;
  language: Language;
  t: Translations;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onNavigateHome: () => void;
  onOpenSignup: (prefill: { name: string; email: string; phone: string }) => void;
  onUpdateVenueName: (name: string) => void;
  onSelectVenue: (venue: Venue) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  if (submittedRequest) {
    const venue = submittedRequest.venueId ? getVenue(submittedRequest.venueId, venueList) : null;
    const requestLocation =
      submittedRequest.requestType === 'find_nearby'
        ? submittedRequest.postcode
        : venue
          ? venueLabel(venue)
          : submittedRequest.venueName;

    return (
      <section className="request-page page-width">
        <div className="request-card request-success-card">
          <div className="success-icon">
            <Check size={28} />
          </div>
          <p className="eyebrow">{t.requestSubmitted}</p>
          <h1>{t.requestSubmitted}</h1>
          <p className="form-intro">{t.requestSubmittedIntro}</p>
          <div className="reference-box">
            <span>{t.requestReference}</span>
            <strong>{submittedRequest.id}</strong>
          </div>
          <div className="request-summary">
            <div>
              <small>{t.location}</small>
              <strong>{requestLocation}</strong>
            </div>
            <div>
              <small>{t.preferredDate}</small>
              <strong>{formatLongDate(submittedRequest.preferredDate, language)}</strong>
            </div>
            <div>
              <small>{t.preferredTimeRange}</small>
              <strong>
                {submittedRequest.startTime}–{submittedRequest.endTime}
              </strong>
            </div>
            <div>
              <small>{t.contact}</small>
              <strong>{submittedRequest.contactName}</strong>
              <span>{submittedRequest.email}</span>
            </div>
          </div>
          <div className="request-guarantee">
            <ShieldCheck size={18} />
            <span>{t.requestPromise}</span>
          </div>
          {!user ? (
            <div className="signup-prompt request-signup-prompt">
              <span>{t.saveRequestPrompt}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onOpenSignup({
                    name: submittedRequest.contactName,
                    email: submittedRequest.email,
                    phone: submittedRequest.phone,
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

  return (
    <section className="request-page page-width">
      <button type="button" className="back-link" onClick={onNavigateHome}>
        <ArrowLeft size={16} /> {t.back}
      </button>
      <div className="request-card">
        <div className="request-heading">
          <p className="eyebrow">
            <CalendarPlus size={14} /> {t.requestCta}
          </p>
          <h1>{t.requestTitle}</h1>
          <p className="form-intro">{t.requestIntro}</p>
          <div className="request-guarantee">
            <ShieldCheck size={18} />
            <span>{t.requestPromise}</span>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-grid two-col">
            <div className="field">
              <Label htmlFor="request-type">
                {t.specifiedVenue} <em>*</em>
              </Label>
              <select
                id="request-type"
                className="native-select"
                value={requestForm.requestType}
                onChange={(event) => {
                  const requestType = event.target.value as ReservationRequestForm['requestType'];
                  setRequestForm((current) => ({
                    ...current,
                    requestType,
                    venueId: null,
                    venueName: '',
                    postcode: requestType === 'find_nearby' ? (user?.postcode ?? current.postcode) : '',
                  }));
                }}
              >
                <option value="known_venue">{t.specifiedVenueYes}</option>
                <option value="find_nearby">{t.specifiedVenueNo}</option>
              </select>
            </div>
            {requestForm.requestType === 'known_venue' ? (
              <div className="field request-location-field">
                <Label htmlFor="request-venue">
                  {t.location} <em>*</em>
                </Label>
                <div className="venue-autocomplete">
                  <Input
                    id="request-venue"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls="request-venue-options"
                    aria-expanded={requestVenueOpen}
                    aria-activedescendant={
                      requestVenueActiveIndex >= 0 ? `request-venue-option-${requestVenueActiveIndex}` : undefined
                    }
                    autoComplete="off"
                    maxLength={160}
                    placeholder={t.locationPlaceholder}
                    value={requestForm.venueName}
                    onChange={(event) => onUpdateVenueName(event.target.value)}
                    onFocus={() => setRequestVenueOpen(true)}
                    onBlur={() => window.setTimeout(() => setRequestVenueOpen(false), 120)}
                    onKeyDown={onKeyDown}
                  />
                  {requestVenueOpen ? (
                    <div id="request-venue-options" className="venue-autocomplete-menu" role="listbox">
                      {requestVenueSuggestions.length ? (
                        requestVenueSuggestions.map((venue, index) => (
                          <button
                            type="button"
                            id={`request-venue-option-${index}`}
                            role="option"
                            aria-selected={requestVenueActiveIndex === index}
                            className={
                              requestVenueActiveIndex === index
                                ? 'venue-autocomplete-option active'
                                : 'venue-autocomplete-option'
                            }
                            key={venue.id}
                            onPointerDown={(event) => event.preventDefault()}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onSelectVenue(venue)}
                          >
                            <strong>{venueLabel(venue)}</strong>
                            <span>{venue.area}</span>
                          </button>
                        ))
                      ) : (
                        <div className="venue-autocomplete-empty">{t.noLocationMatches}</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <small className="field-hint">{t.locationHint}</small>
              </div>
            ) : (
              <div className="field">
                <Label htmlFor="request-postcode">
                  {t.postcode} <em>*</em>
                </Label>
                <Input
                  id="request-postcode"
                  autoComplete="postal-code"
                  maxLength={12}
                  placeholder={t.postcodePlaceholder}
                  value={requestForm.postcode}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      postcode: event.target.value,
                      venueId: null,
                      venueName: '',
                    }))
                  }
                />
                <small className="field-hint">{t.postcodeHint}</small>
              </div>
            )}
            <div className="field">
              <Label htmlFor="request-date">
                {t.preferredDate} <em>*</em>
              </Label>
              <Input
                id="request-date"
                type="date"
                min={dateFromToday(0)}
                value={requestForm.preferredDate}
                onChange={(event) =>
                  setRequestForm((current) => ({ ...current, preferredDate: event.target.value }))
                }
              />
            </div>
            <div className="field request-time-field">
              <Label htmlFor="request-start">
                {t.preferredTimeRange} <em>*</em>
              </Label>
              <div className="time-pair">
                <Input
                  id="request-start"
                  type="time"
                  value={requestForm.startTime}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, startTime: event.target.value }))
                  }
                />
                <span>–</span>
                <Input
                  aria-label={language === 'zh' ? '结束时间' : 'End time'}
                  type="time"
                  value={requestForm.endTime}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, endTime: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="field">
              <Label htmlFor="request-name">
                {t.name} <em>*</em>
              </Label>
              <Input
                id="request-name"
                autoComplete="name"
                value={requestForm.contactName}
                onChange={(event) =>
                  setRequestForm((current) => ({ ...current, contactName: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <Label htmlFor="request-email">
                {t.email} <em>*</em>
              </Label>
              <Input
                id="request-email"
                type="email"
                autoComplete="email"
                value={requestForm.email}
                onChange={(event) =>
                  setRequestForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <Label htmlFor="request-phone">
                {t.phone} <small>({t.optional})</small>
              </Label>
              <Input
                id="request-phone"
                type="tel"
                autoComplete="tel"
                value={requestForm.phone}
                onChange={(event) =>
                  setRequestForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <div className="field request-message-field">
              <Label htmlFor="request-message">
                {t.requestMessage} <small>({t.optional})</small>
              </Label>
              <textarea
                id="request-message"
                className="native-textarea"
                rows={4}
                maxLength={1000}
                placeholder={t.requestMessageHint}
                value={requestForm.message}
                onChange={(event) =>
                  setRequestForm((current) => ({ ...current, message: event.target.value }))
                }
              />
            </div>
          </div>
          {requestError ? (
            <div className="inline-error">
              <TriangleAlert size={16} /> {requestError}
            </div>
          ) : null}
          <Button type="submit" size="lg" className="request-submit" disabled={requestBusy}>
            {requestBusy ? t.submittingRequest : t.submitRequest}
            <ArrowRight size={17} />
          </Button>
        </form>
      </div>
    </section>
  );
}
