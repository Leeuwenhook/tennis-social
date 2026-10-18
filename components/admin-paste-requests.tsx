'use client';

import { useState } from 'react';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';

import { PartnerContactFields, PartnerSlotFields } from '@/components/partner-request-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Venue } from '@/lib/demo-data';
import { parsePartnerRequestDrafts } from '@/lib/partner-request-parser';
import { dateFromToday, LEVELS, venueLabel } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { ReservationRequest, ReservationRequestForm } from '@/types/tennis';

type Contact = Pick<ReservationRequestForm, 'contactName' | 'email' | 'phone'>;

const emptyContact: Contact = { contactName: '', email: '', phone: '' };

function formFromText(source: string, venueList: Venue[]): ReservationRequestForm {
  const [draft] = parsePartnerRequestDrafts(source);
  const requestKind = draft?.requestKind ?? 'find_partners';
  const venueName = draft?.venueName ?? '';
  const venue = venueList.find((item) =>
    [item.name, item.nameZh].some((name) => name.trim().toLocaleLowerCase() === venueName.trim().toLocaleLowerCase()));
  return {
    requestType: requestKind === 'find_court' && !venueName ? 'find_nearby' : 'known_venue',
    venueId: venue?.id ?? null,
    venueName,
    postcode: '',
    preferredDate: draft?.preferredDate ?? '',
    preferredSlots: draft?.preferredSlots ?? [],
    // Unbooked requests use periods (already derived from any parsed times); exact times are booked-only.
    startTime: draft?.venueBookingStatus === 'booked' ? draft.startTime ?? '' : '',
    endTime: draft?.venueBookingStatus === 'booked' ? draft.endTime ?? '' : '',
    ...emptyContact,
    message: source.trim().slice(0, 1000),
    requestKind,
    venueBookingStatus: draft?.venueBookingStatus ?? 'unknown',
    existingPlayerLevels: draft?.existingPlayerLevels ?? [],
    seekingPlayerCount: requestKind === 'find_court' ? 0 : draft?.seekingPlayerCount,
    seekingLevels: draft?.seekingLevels ?? [],
    preferredFormat: draft?.preferredFormat ?? 'flexible',
    budgetPence: null,
  };
}

/** Admin-only tool: turn pasted group-chat posts into partner requests. */
export function AdminPasteRequests({
  venueList,
  t,
  onCreated,
}: {
  venueList: Venue[];
  t: Translations;
  onCreated: (request: ReservationRequest) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [drafts, setDrafts] = useState<ReservationRequestForm[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState<number[]>([]);
  const [contact, setContact] = useState<Contact>(emptyContact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const form = drafts[index];
  const findCourtOnly = form?.requestKind === 'find_court';
  const missing = form ? [
    ...(!form.preferredDate ? [t.preferredDate] : []),
    ...(form.venueBookingStatus !== 'booked' && !form.preferredSlots?.length ? [t.preferredSlots] : []),
    ...(form.venueBookingStatus === 'booked' && (!form.startTime || !form.endTime) ? [t.preferredTimeRange] : []),
    ...(!findCourtOnly && form.seekingPlayerCount === undefined ? [t.seekingPlayers] : []),
  ] : [];

  const setField = <K extends keyof ReservationRequestForm>(key: K, value: ReservationRequestForm[K]) =>
    setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const toggleLevel = (key: 'existingPlayerLevels' | 'seekingLevels', level: string) => {
    const values = form?.[key] ?? [];
    setField(key, values.includes(level) ? values.filter((item) => item !== level) : [...values, level]);
  };
  const changeRequestKind = (kind: ReservationRequestForm['requestKind']) => {
    setDrafts((current) => current.map((item, itemIndex) => itemIndex !== index ? item : {
      ...item,
      requestKind: kind,
      requestType: kind === 'find_partners' ? 'known_venue' : item.requestType,
      seekingPlayerCount: kind === 'find_court' ? 0 : Math.max(1, item.seekingPlayerCount ?? 1),
      seekingLevels: kind === 'find_court' ? [] : item.seekingLevels,
    }));
  };
  const updateVenueName = (value: string) => {
    const venue = venueList.find((item) =>
      [item.name, item.nameZh, venueLabel(item)].some((name) => name.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase()));
    setDrafts((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, venueName: value, venueId: venue?.id ?? null }
      : item));
  };

  const createDrafts = () => {
    const parsed = parsePartnerRequestDrafts(pasteText);
    setDrafts(parsed.map((draft) => formFromText(draft.source, venueList)));
    setLabels(parsed.map((draft) => draft.venueName ?? ''));
    setIndex(0);
    setSubmitted([]);
    setError('');
  };

  const submit = async () => {
    if (!form || busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/reservation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...contact }),
      });
      const data = await response.json() as { request?: ReservationRequest };
      if (!response.ok || !data.request) {
        setError(response.status === 400 ? t.requestInvalid : t.dataUnavailable);
        return;
      }
      onCreated(data.request);
      const nextSubmitted = [...submitted, index];
      setSubmitted(nextSubmitted);
      const next = drafts.findIndex((_, draftIndex) => !nextSubmitted.includes(draftIndex));
      if (next >= 0) setIndex(next);
    } catch {
      setError(t.dataUnavailable);
    } finally {
      setBusy(false);
    }
  };

  const allSubmitted = drafts.length > 0 && submitted.length === drafts.length;

  return (
    <div className="paste-draft-box admin-paste-requests">
      <button type="button" className="paste-draft-toggle" aria-expanded={open} aria-controls="admin-paste-content" onClick={() => setOpen((value) => !value)}>
        {open ? '−' : '+'} {t.pasteRequest}
      </button>
      {open ? <div id="admin-paste-content" className="paste-draft-content">
        <textarea className="native-textarea" rows={5} aria-label={t.pasteRequest} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={t.pasteRequestHint} />
        <div><Button type="button" size="sm" variant="outline" onClick={createDrafts} disabled={!pasteText.trim()}>{t.createDraft}</Button></div>
        <small className="field-hint">{t.pasteRequestNote}</small>
        {drafts.length ? <div className="paste-draft-list" role="group" aria-label={t.detectedDrafts}>
          {drafts.map((_, draftIndex) => <button type="button" aria-pressed={draftIndex === index} className={draftIndex === index ? 'paste-draft-option selected' : 'paste-draft-option'} key={draftIndex} onClick={() => { setIndex(draftIndex); setError(''); }}>{t.detectedDraft} {draftIndex + 1}{labels[draftIndex] ? ` · ${labels[draftIndex]}` : ''}{submitted.includes(draftIndex) ? ` · ${t.draftSubmitted}` : ''}</button>)}
        </div> : null}
        {form && !allSubmitted && !submitted.includes(index) ? <div className="form-grid two-col">
          <div className="field">
            <Label htmlFor="paste-kind">{t.requestKind} <em>*</em></Label>
            <select id="paste-kind" className="native-select" value={form.requestKind ?? 'find_partners'} onChange={(event) => changeRequestKind(event.target.value as ReservationRequestForm['requestKind'])}>
              <option value="find_partners">{t.find_partners}</option>
              <option value="find_court">{t.find_court}</option>
              <option value="find_both">{t.find_both}</option>
            </select>
          </div>
          <div className="field">
            <Label htmlFor="paste-request-type">{t.specifiedVenue} <em>*</em></Label>
            <select id="paste-request-type" className="native-select" value={form.requestType} disabled={form.requestKind === 'find_partners'} onChange={(event) => setField('requestType', event.target.value as ReservationRequestForm['requestType'])}>
              <option value="known_venue">{t.specifiedVenueYes}</option>
              <option value="find_nearby">{t.specifiedVenueNo}</option>
            </select>
          </div>
          {form.requestType === 'known_venue' ? <div className="field">
            <Label htmlFor="paste-venue">{t.location} <em>*</em></Label>
            <Input id="paste-venue" list="paste-venue-options" maxLength={160} value={form.venueName} onChange={(event) => updateVenueName(event.target.value)} />
            <datalist id="paste-venue-options">{venueList.map((venue) => <option key={venue.id} value={venueLabel(venue)}>{venue.area}</option>)}</datalist>
          </div> : <div className="field">
            <Label htmlFor="paste-postcode">{t.postcode} <em>*</em></Label>
            <Input id="paste-postcode" maxLength={12} placeholder={t.postcodePlaceholder} value={form.postcode} onChange={(event) => setField('postcode', event.target.value)} />
          </div>}
          <div className="field">
            <Label htmlFor="paste-booking-status">{t.venueBookingStatus}</Label>
            <select id="paste-booking-status" className="native-select" value={form.venueBookingStatus ?? 'unknown'} onChange={(event) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, venueBookingStatus: event.target.value as ReservationRequestForm['venueBookingStatus'], startTime: '', endTime: '' } : item))}>
              <option value="booked">{t.venueBooked}</option><option value="not_booked">{t.not_booked}</option><option value="unknown">{t.unknown}</option>
            </select>
          </div>
          {form.venueBookingStatus !== 'booked' ? <PartnerSlotFields label={t.preferredSlots} language={t.email === '邮箱' ? 'zh' : 'en'} value={form.preferredSlots} onChange={(slots) => setField('preferredSlots', slots)} /> : null}
          <div className="field">
            <Label htmlFor="paste-date">{t.preferredDate} <em>*</em></Label>
            <Input id="paste-date" type="date" min={dateFromToday(0)} required value={form.preferredDate} onChange={(event) => setField('preferredDate', event.target.value)} />
          </div>
          {form.venueBookingStatus === 'booked' ? <div className="field">
            <Label htmlFor="paste-start">{t.preferredTimeRange} <em>*</em></Label>
            <div className="time-pair">
              <Input id="paste-start" type="time" required value={form.startTime} onChange={(event) => setField('startTime', event.target.value)} />
              <span>–</span>
              <Input aria-label={t.preferredTimeRange} type="time" required value={form.endTime} onChange={(event) => setField('endTime', event.target.value)} />
            </div>
          </div> : null}
          <div className="field request-level-field"><Label>{t.existingLevels}</Label><div className="level-picker">{LEVELS.map((level) => <button type="button" key={`existing-${level}`} aria-pressed={(form.existingPlayerLevels ?? []).includes(level)} className={(form.existingPlayerLevels ?? []).includes(level) ? 'level-chip selected' : 'level-chip'} onClick={() => toggleLevel('existingPlayerLevels', level)}>{level}</button>)}</div></div>
          {!findCourtOnly ? <>
            <div className="field"><Label htmlFor="paste-seeking-count">{t.seekingPlayers} <em>*</em></Label><Input id="paste-seeking-count" type="number" min={1} max={100} value={form.seekingPlayerCount ?? ''} onChange={(event) => setField('seekingPlayerCount', event.target.value === '' ? undefined : Number(event.target.value))} /></div>
            <div className="field request-level-field"><Label>{t.seekingLevels}</Label><div className="level-picker">{LEVELS.map((level) => <button type="button" key={`seeking-${level}`} aria-pressed={(form.seekingLevels ?? []).includes(level)} className={(form.seekingLevels ?? []).includes(level) ? 'level-chip selected' : 'level-chip'} onClick={() => toggleLevel('seekingLevels', level)}>{level}</button>)}</div></div>
          </> : null}
          <div className="field">
            <Label htmlFor="paste-format">{t.requestFormat}</Label>
            <select id="paste-format" className="native-select" value={form.preferredFormat ?? 'flexible'} onChange={(event) => setField('preferredFormat', event.target.value as ReservationRequestForm['preferredFormat'])}>
              <option value="singles">{t.singles}</option><option value="doubles">{t.doubles}</option><option value="practice">{t.practice}</option><option value="flexible">{t.flexible}</option>
            </select>
          </div>
          <div className="field">
            <Label htmlFor="paste-name">{t.name} <em>*</em></Label>
            <Input id="paste-name" value={contact.contactName} onChange={(event) => setContact((current) => ({ ...current, contactName: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="paste-email">{t.email} <em>*</em></Label>
            <Input id="paste-email" required type="email" value={contact.email} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="paste-phone">{t.phone} {form.preferredContact === 'phone' ? <em>*</em> : <small>({t.optional})</small>}</Label>
            <Input id="paste-phone" type="tel" required={form.preferredContact === 'phone'} value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} />
          </div>
          <PartnerContactFields labels={t} value={{ ...form, phone: contact.phone }} onChange={(contacts) => setDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...contacts } : item))} />
          <div className="field request-message-field">
            <Label htmlFor="paste-message">{t.requestMessage} <small>({t.optional})</small></Label>
            <textarea id="paste-message" className="native-textarea" rows={3} maxLength={1000} value={form.message} onChange={(event) => setField('message', event.target.value)} />
          </div>
        </div> : null}
        {missing.length && !submitted.includes(index) ? <small className="field-hint paste-missing">{t.missingFields}: {missing.join(', ')}</small> : null}
        {error ? <div className="inline-error"><TriangleAlert size={16} /> {error}</div> : null}
        {form && !submitted.includes(index) ? <div>
          <Button type="button" size="sm" onClick={() => void submit()} disabled={busy}>
            {busy ? t.submittingRequest : t.submitRequest}
            {drafts.length > 1 ? ` (${t.remainingDrafts}: ${drafts.length - submitted.length})` : ''}
          </Button>
        </div> : null}
      </div> : null}
    </div>
  );
}
