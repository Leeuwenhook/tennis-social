'use client';

import { useState } from 'react';
import Archive from 'lucide-react/dist/esm/icons/archive.mjs';
import ArchiveRestore from 'lucide-react/dist/esm/icons/archive-restore.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatDate,
  formatMoney,
} from '@/lib/formatters';
import { venueUsage } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { CourtSetting, VenueFieldIssue } from '@/lib/venue-form';
import type {
  AdminVenue,
  VenueDraft,
} from '@/types/tennis';

import type { AdminViewProps } from '@/components/admin/admin-view';

function issueMessages(t: Translations): Record<VenueFieldIssue, string> {
  return {
    name: t.venueNameRequired,
    area: t.venueAreaRequired,
    photos: t.venuePhotoRequired,
    peakPrice: t.venuePriceInvalid,
    offPeakPrice: t.venuePriceInvalid,
    priceOrder: t.venuePriceOrder,
    courtCount: t.venueCourtCountInvalid,
    courtSetting: t.venueCourtSettingInvalid,
    floodlights: t.venueFloodlightsInvalid,
  };
}

/** The London calendar day of a timestamp, as YYYY-MM-DD for the shared date formatter. */
function londonDay(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function matchesVenueSearch(venue: AdminVenue, query: string) {
  if (!query) return true;
  return [venue.name, venue.area, venue.postcode ?? '']
    .some((value) => value.toLocaleLowerCase().includes(query));
}

export function AdminVenuesTab(props: AdminViewProps) {
  const {
  venueList,
  adminBusy,
  adminMessage,
  venueEditorOpen,
  venueDraft,
  setVenueDraft,
  venueFieldIssues,
  language,
  t,
  onSaveVenue,
  onChooseVenueImage,
  onReuseVenuePhoto,
  onStartEditVenue,
  onDeleteVenue,
  onArchiveVenue,
  onAddVenue,
  onCancelVenueEdit,
  } = props;
  const [venueSearch, setVenueSearch] = useState('');
  const messages = issueMessages(t);
  const query = venueSearch.trim().toLocaleLowerCase();
  const activeVenues = venueList.filter((venue) => !venue.archivedAt);
  const archivedVenues = venueList.filter((venue) => venue.archivedAt);
  const shownActive = activeVenues.filter((venue) => matchesVenueSearch(venue, query));
  const shownArchived = archivedVenues.filter((venue) => matchesVenueSearch(venue, query));

  /** The first issue for a field, so each field shows one message. */
  function issueFor(...issues: VenueFieldIssue[]) {
    return issues.find((issue) => venueFieldIssues.includes(issue));
  }

  function invalidProps(id: string, issue: VenueFieldIssue | undefined) {
    return issue ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};
  }

  function renderFieldError(id: string, issue: VenueFieldIssue | undefined) {
    return issue ? (
      <p className="admin-field-error" id={`${id}-error`}>
        {messages[issue]}
      </p>
    ) : null;
  }

  function setField<K extends keyof VenueDraft>(field: K, value: VenueDraft[K]) {
    setVenueDraft((current) => ({ ...current, [field]: value }));
  }

  function renderMessage() {
    if (!adminMessage) return null;
    return venueFieldIssues.length ? (
      <div className="inline-error" role="alert">
        <TriangleAlert size={15} /> {adminMessage}
      </div>
    ) : (
      <div className="admin-message">
        <Check size={15} /> {adminMessage}
      </div>
    );
  }

  function renderVenueEditor() {
    const nameIssue = issueFor('name');
    const areaIssue = issueFor('area');
    const peakIssue = issueFor('peakPrice', 'priceOrder');
    const offPeakIssue = issueFor('offPeakPrice');
    const courtCountIssue = issueFor('courtCount');
    const courtSettingIssue = issueFor('courtSetting');
    const floodlightsIssue = issueFor('floodlights');
    const photosIssue = issueFor('photos');
    return (
      // Keyed by venue so switching venues remounts the form and its scroll starts at the top.
      <form key={venueDraft.id ?? 'new'} className="admin-editor venue-editor" onSubmit={onSaveVenue} noValidate>
        <div className="admin-editor-heading">
          <div>
            <p className="eyebrow muted">{venueDraft.id ? t.editVenue : t.addVenue}</p>
            <h2>{venueDraft.id ? t.editVenue : t.addVenue}</h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={onCancelVenueEdit}
          >
            {t.cancelEdit}
          </button>
        </div>
        <div className="form-grid two-col">
          <div className="field">
            <Label htmlFor="venue-name">
              {t.venueName} <em>*</em>
            </Label>
            <Input
              id="venue-name"
              value={venueDraft.name}
              onChange={(event) => setField('name', event.target.value)}
              {...invalidProps('venue-name', nameIssue)}
            />
            {renderFieldError('venue-name', nameIssue)}
          </div>
          <div className="field">
            <Label htmlFor="venue-area">
              {t.area} <em>*</em>
            </Label>
            <Input
              id="venue-area"
              value={venueDraft.area}
              onChange={(event) => setField('area', event.target.value)}
              {...invalidProps('venue-area', areaIssue)}
            />
            {renderFieldError('venue-area', areaIssue)}
          </div>
          <div className="field">
            <Label htmlFor="venue-description">Venue description (English)</Label>
            <textarea id="venue-description" className="native-textarea" rows={3} maxLength={2000}
              placeholder="留空自动生成 / Leave empty to auto-generate"
              value={venueDraft.description}
              onChange={(event) => setField('description', event.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="venue-descriptionZh">场地介绍（中文）</Label>
            <textarea id="venue-descriptionZh" className="native-textarea" rows={3} maxLength={2000}
              placeholder="留空自动生成 / Leave empty to auto-generate"
              value={venueDraft.descriptionZh}
              onChange={(event) => setField('descriptionZh', event.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="venue-address">{language === 'zh' ? '详细地址' : 'Street address'}</Label>
            <Input id="venue-address" value={venueDraft.address} onChange={(event) => setField('address', event.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="venue-postcode">{t.postcode}</Label>
            <Input id="venue-postcode" value={venueDraft.postcode} onChange={(event) => setField('postcode', event.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="venue-address-zh">{language === 'zh' ? '中文地址' : 'Chinese address'}</Label>
            <Input id="venue-address-zh" value={venueDraft.addressZh} onChange={(event) => setField('addressZh', event.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="venue-peak-price">
              {t.peakPrice} <em>*</em>
            </Label>
            <div className="input-prefix">
              <span>£</span>
              <Input
                id="venue-peak-price"
                inputMode="decimal"
                value={venueDraft.peakPrice}
                onChange={(event) => setField('peakPrice', event.target.value)}
                {...invalidProps('venue-peak-price', peakIssue)}
              />
            </div>
            {renderFieldError('venue-peak-price', peakIssue)}
          </div>
          <div className="field">
            <Label htmlFor="venue-off-peak-price">
              {t.offPeakPrice} <em>*</em>
            </Label>
            <div className="input-prefix">
              <span>£</span>
              <Input
                id="venue-off-peak-price"
                inputMode="decimal"
                value={venueDraft.offPeakPrice}
                onChange={(event) => setField('offPeakPrice', event.target.value)}
                {...invalidProps('venue-off-peak-price', offPeakIssue)}
              />
            </div>
            {renderFieldError('venue-off-peak-price', offPeakIssue)}
          </div>
          <p className="admin-field-note venue-price-note">{t.venuePriceNote}</p>
          <div className="field">
            <Label htmlFor="venue-court-count">{t.courtCount}</Label>
            <Input
              id="venue-court-count"
              inputMode="numeric"
              value={venueDraft.courtCount}
              onChange={(event) => setField('courtCount', event.target.value)}
              {...invalidProps('venue-court-count', courtCountIssue)}
            />
            {renderFieldError('venue-court-count', courtCountIssue)}
          </div>
          <div className="field">
            <Label htmlFor="venue-court-setting">{t.courtSetting}</Label>
            <select
              id="venue-court-setting"
              className="native-select"
              value={venueDraft.courtSetting}
              onChange={(event) => setField('courtSetting', event.target.value as '' | CourtSetting)}
              {...invalidProps('venue-court-setting', courtSettingIssue)}
            >
              <option value="">{t.courtSettingUnknown}</option>
              <option value="indoor">{t.courtSettingIndoor}</option>
              <option value="outdoor">{t.courtSettingOutdoor}</option>
              <option value="mixed">{t.courtSettingMixed}</option>
            </select>
            {renderFieldError('venue-court-setting', courtSettingIssue)}
          </div>
          <div className="field">
            <Label htmlFor="venue-floodlights">{t.floodlights}</Label>
            <select
              id="venue-floodlights"
              className="native-select"
              value={venueDraft.floodlights}
              onChange={(event) => setField('floodlights', event.target.value as VenueDraft['floodlights'])}
              {...invalidProps('venue-floodlights', floodlightsIssue)}
            >
              <option value="">{t.floodlightsUnknown}</option>
              <option value="yes">{t.floodlightsYes}</option>
              <option value="no">{t.floodlightsNo}</option>
            </select>
            {renderFieldError('venue-floodlights', floodlightsIssue)}
          </div>
        </div>
        <div className="field venue-image-field">
          <Label htmlFor="venue-photo">
            {t.venueImage} <em>*</em>
          </Label>
          <Input
            id="venue-photo"
            type="text"
            value={venueDraft.photo.startsWith('data:') ? '' : venueDraft.photo}
            placeholder={t.imageUrl}
            {...invalidProps('venue-photo', photosIssue)}
            onChange={(event) =>
              setVenueDraft((current) => ({
                ...current,
                photo: event.target.value,
                photos: event.target.value.trim()
                  ? [event.target.value.trim(), ...current.photos.slice(1)]
                  : current.photos,
                notes: current.notes.replace(/\s*[（(]复用照片[）)]\s*/g, '').trim(),
              }))
            }
          />
          {renderFieldError('venue-photo', photosIssue)}
          <div className="venue-upload-row">
            <Input
              id="venue-photo-file"
              type="file"
              accept="image/*"
              multiple
              aria-label={t.replaceImage}
              onChange={onChooseVenueImage}
            />
            <span>
              {t.replaceImage} · {t.uploadImage}
            </span>
          </div>
          <div className="venue-image-actions">
            {venueDraft.photos.map((photo, index) => (
              <div className="venue-photo-item" key={`${photo.slice(0, 30)}-${index}`}>
                <img src={photo} alt={`${venueDraft.name || t.venueImage} ${index + 1}`} />
                <a
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  href={photo}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.viewImage}
                </a>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    setVenueDraft((current) => {
                      const photos = current.photos.filter((_, itemIndex) => itemIndex !== index);
                      return { ...current, photos, photo: photos[0] ?? '' };
                    })
                  }
                >
                  {t.removeImage}
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={onReuseVenuePhoto}>
              {t.reuseImage}
            </Button>
          </div>
          <p className="admin-field-note">{t.imageHelp}</p>
        </div>
        <div className="field">
          <Label htmlFor="venue-notes">{t.venueNotes}</Label>
          <textarea
            id="venue-notes"
            value={venueDraft.notes}
            onChange={(event) => setField('notes', event.target.value)}
            className="native-textarea"
            rows={2}
            placeholder={t.venueNotes}
          />
        </div>
        {renderMessage()}
        <Button type="submit" disabled={adminBusy}>
          <Check size={16} /> {adminBusy ? t.saving : t.saveVenue}
        </Button>
      </form>
    );
  }

  function renderVenueRow(venue: AdminVenue) {
    const usage = venueUsage(venue);
    const usageText = [
      venue.sessionCount ? t.venueUsedBySessions.replace('{count}', String(venue.sessionCount)) : '',
      venue.requestCount ? t.venueUsedByRequests.replace('{count}', String(venue.requestCount)) : '',
    ].filter(Boolean).join(' · ');
    const updatedDay = venue.updatedAt ? londonDay(venue.updatedAt) : null;
    const meta = [
      typeof venue.futureSessionCount === 'number'
        ? t.venueUpcomingSessions.replace('{count}', String(venue.futureSessionCount))
        : '',
      updatedDay ? t.venueUpdatedOn.replace('{date}', formatDate(updatedDay, language)) : '',
    ].filter(Boolean).join(' · ');
    return (
      <div className={`admin-venue-row${venue.archivedAt ? ' is-archived' : ''}`} key={venue.id}>
        <a
          className="admin-venue-photo-link"
          href={venue.photo}
          target="_blank"
          rel="noreferrer"
          title={t.viewImage}
        >
          <img src={venue.photo} alt={venue.name} />
        </a>
        <div className="admin-venue-row-main">
          <strong>{venue.name}</strong>
          <span>{[venue.area, venue.postcode].filter(Boolean).join(' · ')}</span>
          <small>
            {t.peakPrice}: {formatMoney(venue.peakPricePence, language)} · {t.offPeakPrice}:{' '}
            {formatMoney(venue.offPeakPricePence, language)}
          </small>
          {meta ? <small className="admin-venue-meta">{meta}</small> : null}
          {usageText ? <small className="admin-venue-meta">{usageText}</small> : null}
          {venue.notes ? <small className="admin-venue-note">{venue.notes}</small> : null}
        </div>
        <div className="admin-row-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStartEditVenue(venue)}
            disabled={adminBusy}
          >
            <Pencil size={14} /> {t.edit}
          </Button>
          {venue.archivedAt ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onArchiveVenue(venue, false)}
              disabled={adminBusy}
            >
              <ArchiveRestore size={14} /> {t.restoreVenue}
            </Button>
          ) : usage > 0 ? (
            <Button
              variant="outline"
              size="sm"
              title={usageText}
              onClick={() => onArchiveVenue(venue, true)}
              disabled={adminBusy}
            >
              <Archive size={14} /> {t.archiveVenue}
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDeleteVenue(venue)}
              disabled={adminBusy}
            >
              <Trash2 size={14} /> {t.delete}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
            <div className={`admin-venue-layout${venueEditorOpen ? '' : ' venue-layout-full'}`}>
              <div className="admin-venue-list">
                <div className="admin-list-heading">
                  <div>
                    <p className="eyebrow muted">{t.manageVenues}</p>
                    <h2>{t.venueList}</h2>
                    <p>{t.venueListIntro}</p>
                  </div>
                  <div className="admin-list-heading-actions">
                    <Badge variant="secondary">{activeVenues.length}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onAddVenue}
                      disabled={adminBusy}
                    >
                      <Plus size={14} /> {t.addVenue}
                    </Button>
                  </div>
                </div>
                <div className="admin-venue-search">
                  <Search size={15} aria-hidden="true" />
                  <Input
                    type="search"
                    aria-label={t.venueSearch}
                    placeholder={t.venueSearchPlaceholder}
                    value={venueSearch}
                    onChange={(event) => setVenueSearch(event.target.value)}
                  />
                </div>
                {venueEditorOpen ? null : renderMessage()}
                {shownActive.map(renderVenueRow)}
                {query && !shownActive.length && !shownArchived.length ? (
                  <p className="admin-venue-empty">{t.noVenueMatches}</p>
                ) : null}
                {shownArchived.length ? (
                  <details className="admin-venue-archived" open={Boolean(query) || undefined}>
                    <summary>{t.archivedVenues.replace('{count}', String(shownArchived.length))}</summary>
                    {shownArchived.map(renderVenueRow)}
                  </details>
                ) : null}
              </div>
              {venueEditorOpen ? renderVenueEditor() : null}
            </div>
  );
}
