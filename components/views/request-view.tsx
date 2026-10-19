'use client';

import { useState, type KeyboardEvent, type SubmitEvent } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarPlus from 'lucide-react/dist/esm/icons/calendar-plus.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';

import { contactHandleRequired, contactHandleValue, PartnerContactFields, PartnerSlotFields } from '@/components/partner-request-fields';
import { slotLabels } from '@/lib/partner-request-slots';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Venue } from '@/lib/demo-data';
import { formatLongDate } from '@/lib/formatters';
import { dateFromToday, getVenue, LEVELS, venueLabel } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { Language, ReservationRequest, ReservationRequestForm, UserProfile } from '@/types/tennis';

const budgetPenceFromText = (text: string) => {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
};

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
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
  onNavigateHome: () => void;
  onOpenSignup: (prefill: { name: string; email: string; phone: string }) => void;
  onUpdateVenueName: (name: string) => void;
  onSelectVenue: (venue: Venue) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [budgetText, setBudgetText] = useState(() => requestForm.budgetPence == null ? '' : (requestForm.budgetPence / 100).toFixed(2));
  const structured = requestForm.requestKind !== undefined;
  const findCourtOnly = requestForm.requestKind === 'find_court';
  const courtBooked = requestForm.requestKind === 'find_partners' || requestForm.venueBookingStatus === 'booked';
  // Keep the typed text while it still represents the form value; reformat only when the value changed elsewhere (e.g. switching drafts).
  const budgetValue = budgetPenceFromText(budgetText) === (requestForm.budgetPence ?? null)
    ? budgetText
    : requestForm.budgetPence == null ? '' : (requestForm.budgetPence / 100).toFixed(2);
  const setField = <K extends keyof ReservationRequestForm>(key: K, value: ReservationRequestForm[K]) =>
    setRequestForm((current) => ({ ...current, [key]: value }));
  const toggleLevel = (key: 'existingPlayerLevels' | 'seekingLevels', level: string) => {
    setRequestForm((current) => {
      const values = current[key] ?? [];
      return { ...current, [key]: values.includes(level) ? values.filter((item) => item !== level) : [...values, level] };
    });
  };
  const changeRequestKind = (kind: ReservationRequestForm['requestKind']) => {
    setRequestForm((current) => {
      const requestType = kind === 'find_partners' ? 'known_venue' : kind === 'find_court' ? 'find_nearby' : current.requestType;
      const typeChanged = requestType !== current.requestType;
      // "Have a court, need partners" implies the court is booked, so the status select is hidden.
      const venueBookingStatus = kind === 'find_partners' ? 'booked' : current.requestKind === 'find_partners' ? 'unknown' : current.venueBookingStatus;
      const statusChanged = venueBookingStatus !== current.venueBookingStatus;
      return {
        ...current,
        requestKind: kind,
        venueBookingStatus,
        startTime: statusChanged ? '' : current.startTime,
        endTime: statusChanged ? '' : current.endTime,
        requestType,
        venueId: typeChanged ? null : current.venueId,
        venueName: typeChanged ? '' : current.venueName,
        postcode: typeChanged ? (requestType === 'find_nearby' ? (user?.postcode ?? current.postcode) : '') : current.postcode,
        seekingPlayerCount: kind === 'find_court' ? 0 : Math.max(1, current.seekingPlayerCount ?? 1),
        seekingLevels: kind === 'find_court' ? [] : current.seekingLevels,
      };
    });
  };
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
                {submittedRequest.venueBookingStatus === 'booked' && submittedRequest.startTime && submittedRequest.endTime ? `${submittedRequest.startTime}–${submittedRequest.endTime}` : slotLabels(submittedRequest.preferredSlots, language)}
              </strong>
            </div>
            {submittedRequest.requestKind ? <>
              <div><small>{t.requestKind}</small><strong>{t[submittedRequest.requestKind]}</strong></div>
              <div><small>{t.seekingPlayers}</small><strong>{submittedRequest.seekingPlayerCount ?? 0}</strong></div>
              <div><small>{t.requestFormat}</small><strong>{t[submittedRequest.preferredFormat ?? 'flexible']}</strong></div>
            </> : null}
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
          <Button size="lg" className="primary-wide request-next-draft" onClick={onNavigateHome}>
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
            <div className="field request-kind-field">
              <Label htmlFor="request-kind">{t.requestKind} <em>*</em></Label>
              <select id="request-kind" className="native-select" value={requestForm.requestKind ?? 'find_court'} onChange={(event) => changeRequestKind(event.target.value as ReservationRequestForm['requestKind'])}>
                <option value="find_partners">{t.find_partners}</option>
                <option value="find_court">{t.find_court}</option>
                <option value="find_both">{t.find_both}</option>
              </select>
            </div>
            <div className="field">
              <Label htmlFor="request-type">
                {t.specifiedVenue} <em>*</em>
              </Label>
              <select
                id="request-type"
                className="native-select"
                value={requestForm.requestType}
                disabled={requestForm.requestKind === 'find_partners'}
                aria-describedby={requestForm.requestKind === 'find_partners' ? 'request-type-hint' : undefined}
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
              {requestForm.requestKind === 'find_partners' ? <small id="request-type-hint" className="field-hint">{t.requestKindNeedsVenue}</small> : null}
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
            {structured ? <>
              {requestForm.requestKind !== 'find_partners' ? <div className="field">
                <Label htmlFor="request-booking-status">{t.venueBookingStatus} <em>*</em></Label>
                <select id="request-booking-status" className="native-select" value={requestForm.venueBookingStatus ?? 'unknown'} onChange={(event) => setRequestForm((current) => ({ ...current, venueBookingStatus: event.target.value as ReservationRequestForm['venueBookingStatus'], startTime: '', endTime: '' }))}>
                  <option value="booked">{t.venueBooked}</option><option value="not_booked">{t.not_booked}</option><option value="unknown">{t.unknown}</option>
                </select>
              </div> : null}
              <div className="field request-level-field"><Label>{t.existingLevels}</Label><div className="level-picker">{LEVELS.map((level) => <button type="button" key={`existing-${level}`} aria-pressed={(requestForm.existingPlayerLevels ?? []).includes(level)} className={(requestForm.existingPlayerLevels ?? []).includes(level) ? 'level-chip selected' : 'level-chip'} onClick={() => toggleLevel('existingPlayerLevels', level)}>{level}</button>)}</div></div>
              {!findCourtOnly ? <>
              <div className="field"><Label htmlFor="seeking-count">{t.seekingPlayers} <em>*</em></Label><Input id="seeking-count" type="number" min={1} max={100} value={requestForm.seekingPlayerCount ?? ''} onChange={(event) => setField('seekingPlayerCount', event.target.value === '' ? undefined : Number(event.target.value))} /></div>
              <div className="field request-level-field"><Label>{t.seekingLevels}</Label><div className="level-picker">{LEVELS.map((level) => <button type="button" key={`seeking-${level}`} aria-pressed={(requestForm.seekingLevels ?? []).includes(level)} className={(requestForm.seekingLevels ?? []).includes(level) ? 'level-chip selected' : 'level-chip'} onClick={() => toggleLevel('seekingLevels', level)}>{level}</button>)}</div></div>
              </> : null}
              <div className="field"><Label htmlFor="request-format">{t.requestFormat}</Label><select id="request-format" className="native-select" value={requestForm.preferredFormat ?? 'flexible'} onChange={(event) => setField('preferredFormat', event.target.value as ReservationRequestForm['preferredFormat'])}><option value="singles">{t.singles}</option><option value="doubles">{t.doubles}</option><option value="practice">{t.practice}</option><option value="flexible">{t.flexible}</option></select></div>
              <div className="field"><Label htmlFor="request-budget">{t.budget} <small>({t.optional})</small></Label><Input id="request-budget" type="number" min={0} step={0.01} value={budgetValue} onChange={(event) => { setBudgetText(event.target.value); setField('budgetPence', budgetPenceFromText(event.target.value)); }} /></div>
            </> : null}
            <div className="field">
              <Label htmlFor="request-date">
                {t.preferredDate} <em>*</em>
              </Label>
              <Input
                id="request-date"
                required
                type="date"
                min={dateFromToday(0)}
                value={requestForm.preferredDate}
                onChange={(event) =>
                  setRequestForm((current) => ({ ...current, preferredDate: event.target.value }))
                }
              />
            </div>
            {courtBooked ? <>
            <div className="field request-time-field">
              <Label htmlFor="request-start">
                {t.preferredTimeRange} <em>*</em>
              </Label>
              <div className="time-pair">
                <Input
                  id="request-start"
                  type="time" required
                  value={requestForm.startTime}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, startTime: event.target.value }))
                  }
                />
                <span>–</span>
                <Input
                  aria-label={language === 'zh' ? '结束时间' : 'End time'}
                  type="time" required
                  value={requestForm.endTime}
                  onChange={(event) =>
                    setRequestForm((current) => ({ ...current, endTime: event.target.value }))
                  }
                />
              </div>
            </div>
            </> : <PartnerSlotFields label={t.preferredSlots} language={language} value={requestForm.preferredSlots} onChange={(slots) => setField('preferredSlots', slots)} />}
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
                id="request-email" required
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
                {t.contactHandle} {contactHandleRequired(requestForm.preferredContact) ? <em>*</em> : <small>({t.optional})</small>}
              </Label>
              <Input
                id="request-phone" required={contactHandleRequired(requestForm.preferredContact)}
                type="text"
                maxLength={40}
                autoComplete="tel"
                value={contactHandleValue(requestForm)}
                onChange={(event) =>
                  setRequestForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <PartnerContactFields value={requestForm} labels={t} onChange={(contacts) => setRequestForm((current) => ({ ...current, ...contacts }))} />
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
