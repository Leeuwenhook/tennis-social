'use client';

import type { ChangeEvent, FormEvent, RefObject } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.mjs';
import Repeat2 from 'lucide-react/dist/esm/icons/repeat-2.mjs';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';
import Timer from 'lucide-react/dist/esm/icons/timer.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';
import Upload from 'lucide-react/dist/esm/icons/upload.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GAME_FORMATS, type Venue } from '@/lib/demo-data';
import {
  bookingStatusLabel,
  formatDate,
  formatLongDate,
  formatMoney,
  formatNames,
  requestStatusLabel,
} from '@/lib/formatters';
import { emptyDraft, emptyVenueDraft, getVenue, LEVELS, shiftDate, venueLabel } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type {
  AdminTab,
  Booking,
  Language,
  ReservationRequest,
  ReservationRequestStatus,
  Session,
  SessionDraft,
  SessionStatus,
  VenueDraft,
} from '@/types/tennis';

export function AdminView({
  adminAuthChecked,
  adminAuthenticated,
  adminAuthBusy,
  adminAuthError,
  adminLogin,
  setAdminLogin,
  onSubmitAdminLogin,
  adminTab,
  setAdminTab,
  sessions,
  adminSessions,
  allSessions,
  venueList,
  bookings,
  activeBookings,
  reservationRequests,
  publishedCount,
  openSpots,
  racketRentalEnabled,
  racketRentalBusy,
  onUpdateRacketRental,
  adminBusy,
  adminMessage,
  sessionEditorOpen,
  setSessionEditorOpen,
  venueEditorOpen,
  setVenueEditorOpen,
  draft,
  setDraft,
  venueDraft,
  setVenueDraft,
  showExpiredSessions,
  setShowExpiredSessions,
  sessionView,
  setSessionView,
  calendarDate,
  setCalendarDate,
  calendarDays,
  sessionDateFilter,
  setSessionDateFilter,
  sessionVenueFilter,
  setSessionVenueFilter,
  sessionStatusFilter,
  setSessionStatusFilter,
  selectedSessionIds,
  setSelectedSessionIds,
  undoSessions,
  sessionImportInput,
  sessionImportMessage,
  sessionImportFailed,
  language,
  t,
  onResetDemo,
  onLogoutAdmin,
  onSaveDraft,
  onSaveVenue,
  onChooseVenueImage,
  onReuseVenuePhoto,
  onApplyVenueDefaultPrice,
  onStartEditSession,
  onCreateRecurringSessions,
  onDeleteSession,
  onBulkUpdateSessionStatus,
  onExportSessions,
  onUndoLastOperation,
  onImportSessions,
  onCancelBooking,
  onUpdateReservationRequestStatus,
  onStartEditVenue,
  onDeleteVenue,
}: {
  adminAuthChecked: boolean;
  adminAuthenticated: boolean;
  adminAuthBusy: boolean;
  adminAuthError: string;
  adminLogin: { username: string; password: string };
  setAdminLogin: React.Dispatch<React.SetStateAction<{ username: string; password: string }>>;
  onSubmitAdminLogin: (e: FormEvent<HTMLFormElement>) => void;
  adminTab: AdminTab;
  setAdminTab: (tab: AdminTab) => void;
  sessions: Session[];
  adminSessions: Session[];
  allSessions: Session[];
  venueList: Venue[];
  bookings: Booking[];
  activeBookings: Booking[];
  reservationRequests: ReservationRequest[];
  publishedCount: number;
  openSpots: number;
  racketRentalEnabled: boolean;
  racketRentalBusy: boolean;
  onUpdateRacketRental: (enabled: boolean) => void;
  adminBusy: boolean;
  adminMessage: string;
  sessionEditorOpen: boolean;
  setSessionEditorOpen: (open: boolean) => void;
  venueEditorOpen: boolean;
  setVenueEditorOpen: (open: boolean) => void;
  draft: SessionDraft;
  setDraft: React.Dispatch<React.SetStateAction<SessionDraft>>;
  venueDraft: VenueDraft;
  setVenueDraft: React.Dispatch<React.SetStateAction<VenueDraft>>;
  showExpiredSessions: boolean;
  setShowExpiredSessions: (show: boolean | ((prev: boolean) => boolean)) => void;
  sessionView: 'list' | 'week';
  setSessionView: (view: 'list' | 'week') => void;
  calendarDate: string;
  setCalendarDate: (date: string) => void;
  calendarDays: string[];
  sessionDateFilter: string;
  setSessionDateFilter: (filter: string) => void;
  sessionVenueFilter: string;
  setSessionVenueFilter: (filter: string) => void;
  sessionStatusFilter: SessionStatus | '';
  setSessionStatusFilter: (filter: SessionStatus | '') => void;
  selectedSessionIds: string[];
  setSelectedSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
  undoSessions: Session[] | null;
  sessionImportInput: RefObject<HTMLInputElement | null>;
  sessionImportMessage: string;
  sessionImportFailed: boolean;
  language: Language;
  t: Translations;
  onResetDemo: () => void;
  onLogoutAdmin: () => void;
  onSaveDraft: (e: FormEvent<HTMLFormElement>) => void;
  onSaveVenue: (e: FormEvent<HTMLFormElement>) => void;
  onChooseVenueImage: (e: ChangeEvent<HTMLInputElement>) => void;
  onReuseVenuePhoto: () => void;
  onApplyVenueDefaultPrice: (kind: 'peak' | 'offPeak') => void;
  onStartEditSession: (session: Session) => void;
  onCreateRecurringSessions: (session: Session) => void;
  onDeleteSession: (session: Session) => void;
  onBulkUpdateSessionStatus: (status: SessionStatus) => void;
  onExportSessions: () => void;
  onUndoLastOperation: () => void;
  onImportSessions: (e: ChangeEvent<HTMLInputElement>) => void;
  onCancelBooking: (id: string) => void;
  onUpdateReservationRequestStatus: (id: string, status: ReservationRequestStatus) => void;
  onStartEditVenue: (venue: Venue) => void;
  onDeleteVenue: (venue: Venue) => void;
}) {
  if (!adminAuthChecked || !adminAuthenticated) {
    if (!adminAuthChecked) {
      return (
        <section className="admin-page page-width">
          <div className="admin-login-card">
            <p className="eyebrow">
              <Settings2 size={14} /> {t.admin}
            </p>
            <h1>{t.checkingAccess}</h1>
          </div>
        </section>
      );
    }
    return (
      <section className="admin-page page-width">
        <form className="admin-login-card" onSubmit={onSubmitAdminLogin}>
          <p className="eyebrow">
            <Settings2 size={14} /> {t.admin}
          </p>
          <h1>{t.adminLoginTitle}</h1>
          <p>{t.adminLoginIntro}</p>
          <div className="login-fields">
            <div className="field">
              <Label htmlFor="admin-username">{t.username}</Label>
              <Input
                id="admin-username"
                value={adminLogin.username}
                onChange={(event) =>
                  setAdminLogin((current) => ({ ...current, username: event.target.value }))
                }
                autoComplete="username"
              />
            </div>
            <div className="field">
              <Label htmlFor="admin-password">{t.password}</Label>
              <Input
                id="admin-password"
                type="password"
                value={adminLogin.password}
                onChange={(event) =>
                  setAdminLogin((current) => ({ ...current, password: event.target.value }))
                }
                autoComplete="current-password"
              />
            </div>
          </div>
          {adminAuthError ? (
            <div className="inline-error">
              <TriangleAlert size={16} /> {adminAuthError}
            </div>
          ) : null}
          <Button type="submit" size="lg" disabled={adminAuthBusy}>
            {adminAuthBusy ? t.signingIn : t.signIn}
            <ArrowRight size={17} />
          </Button>
        </form>
      </section>
    );
  }

  function renderSessionEditor() {
    const hasActiveBookings = draft.id
      ? bookings.some((booking) => booking.sessionId === draft.id && booking.status === 'confirmed')
      : false;

    return (
      <form className="admin-editor" onSubmit={onSaveDraft}>
        <div className="admin-editor-heading">
          <div>
            <p className="eyebrow muted">{draft.id ? t.editSession : t.addSession}</p>
            <h2>{draft.id ? t.editSession : t.addSession}</h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSessionEditorOpen(false);
              setDraft(emptyDraft(venueList));
            }}
          >
            {t.cancelEdit}
          </button>
        </div>
        <div className="form-grid two-col">
          <div className="field">
            <Label htmlFor="admin-venue">{t.location}</Label>
            <select
              id="admin-venue"
              value={draft.venueId}
              onChange={(event) =>
                setDraft((current) => {
                  const venue = getVenue(event.target.value, venueList);
                  return {
                    ...current,
                    venueId: event.target.value,
                    price: current.id ? current.price : String(venue.offPeakPricePence / 100),
                  };
                })
              }
              className="native-select"
              disabled={hasActiveBookings}
            >
              {venueList.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <Label htmlFor="admin-date">{t.date}</Label>
            <Input
              id="admin-date"
              type="date"
              value={draft.date}
              onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
              disabled={hasActiveBookings}
            />
          </div>
          <div className="field">
            <Label htmlFor="admin-start">{t.time}</Label>
            <div className="time-pair">
              <Input
                id="admin-start"
                type="time"
                value={draft.startTime}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, startTime: event.target.value }))
                }
                disabled={hasActiveBookings}
              />
              <span>–</span>
              <Input
                id="admin-end"
                type="time"
                value={draft.endTime}
                onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))}
                disabled={hasActiveBookings}
              />
            </div>
          </div>
          <div className="field">
            <Label htmlFor="admin-price">{t.pricePerPerson}</Label>
            <div className="input-prefix">
              <span>£</span>
              <Input
                id="admin-price"
                inputMode="decimal"
                value={draft.price}
                onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))}
                disabled={hasActiveBookings}
              />
            </div>
            <div className="default-price-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => onApplyVenueDefaultPrice('peak')}
                disabled={hasActiveBookings}
              >
                {t.usePeakPrice}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => onApplyVenueDefaultPrice('offPeak')}
                disabled={hasActiveBookings}
              >
                {t.useOffPeakPrice}
              </button>
            </div>
          </div>
          <div className="field">
            <Label htmlFor="admin-capacity">{t.capacity}</Label>
            <Input
              id="admin-capacity"
              type="number"
              min="1"
              value={draft.capacity}
              onChange={(event) => setDraft((current) => ({ ...current, capacity: event.target.value }))}
            />
          </div>
          <div className="field">
            <Label htmlFor="admin-status">{t.status}</Label>
            <select
              id="admin-status"
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({ ...current, status: event.target.value as SessionStatus }))
              }
              className="native-select"
            >
              <option value="published">{t.published}</option>
              <option value="draft">{t.draft}</option>
            </select>
          </div>
          <div className="field admin-format-field">
            <span className="field-label">{t.formats}</span>
            <fieldset className="format-checkboxes">
              <legend className="sr-only">{t.formats}</legend>
              {GAME_FORMATS.map((format) => (
                <label className="format-checkbox" key={format}>
                  <input
                    type="checkbox"
                    checked={draft.formats.includes(format)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        formats: event.target.checked
                          ? [...new Set([...current.formats, format])]
                          : current.formats.filter((item) => item !== format),
                      }))
                    }
                  />
                  <span>{formatNames([format], t)}</span>
                </label>
              ))}
            </fieldset>
          </div>
          <div className="field admin-format-field">
            <span className="field-label">
              {language === 'zh' ? '预设寻找水平' : 'Preset levels to find'}
            </span>
            <fieldset className="format-checkboxes">
              <legend className="sr-only">
                {language === 'zh' ? '预设寻找水平' : 'Preset levels to find'}
              </legend>
              {LEVELS.map((level) => (
                <label className="format-checkbox" key={level}>
                  <input
                    type="checkbox"
                    checked={(draft.seekingLevels ?? []).includes(level)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        seekingLevels: event.target.checked
                          ? [...new Set([...(current.seekingLevels ?? []), level])]
                          : (current.seekingLevels ?? []).filter((item) => item !== level),
                      }))
                    }
                  />
                  <span>{level}</span>
                </label>
              ))}
            </fieldset>
            <small className="admin-field-note">
              {language === 'zh'
                ? '报名产生的水平也会自动显示。'
                : 'Booked player levels will also appear automatically.'}
            </small>
          </div>
        </div>
        {hasActiveBookings ? (
          <p className="admin-field-note">
            <ShieldCheck size={15} /> {t.lockedFields}
          </p>
        ) : null}
        <div className="form-grid two-col">
          <div className="field">
            <Label htmlFor="admin-description">English description</Label>
            <textarea
              id="admin-description"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
              className="native-textarea"
              rows={3}
            />
          </div>
          <div className="field">
            <Label htmlFor="admin-description-zh">中文介绍</Label>
            <textarea
              id="admin-description-zh"
              value={draft.descriptionZh}
              onChange={(event) =>
                setDraft((current) => ({ ...current, descriptionZh: event.target.value }))
              }
              className="native-textarea"
              rows={3}
            />
          </div>
        </div>
        {adminMessage ? (
          <div className="admin-message">
            <Check size={15} /> {adminMessage}
          </div>
        ) : null}
        <Button type="submit" disabled={adminBusy}>
          <Check size={16} /> {adminBusy ? t.saving : t.saveSession}
        </Button>
      </form>
    );
  }

  function renderVenueEditor() {
    return (
      <form className="admin-editor venue-editor" onSubmit={onSaveVenue}>
        <div className="admin-editor-heading">
          <div>
            <p className="eyebrow muted">{venueDraft.id ? t.editVenue : t.addVenue}</p>
            <h2>{venueDraft.id ? t.editVenue : t.addVenue}</h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setVenueEditorOpen(false);
              setVenueDraft(emptyVenueDraft(venueList));
            }}
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
              onChange={(event) => setVenueDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="field">
            <Label htmlFor="venue-area">
              {t.area} <em>*</em>
            </Label>
            <Input
              id="venue-area"
              value={venueDraft.area}
              onChange={(event) => setVenueDraft((current) => ({ ...current, area: event.target.value }))}
            />
          </div>
          <div className="field">
            <Label htmlFor="venue-address">{language === 'zh' ? '详细地址' : 'Street address'}</Label>
            <Input id="venue-address" value={venueDraft.address} onChange={(event) => setVenueDraft((current) => ({ ...current, address: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="venue-postcode">{t.postcode}</Label>
            <Input id="venue-postcode" value={venueDraft.postcode} onChange={(event) => setVenueDraft((current) => ({ ...current, postcode: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="venue-address-zh">{language === 'zh' ? '中文地址' : 'Chinese address'}</Label>
            <Input id="venue-address-zh" value={venueDraft.addressZh} onChange={(event) => setVenueDraft((current) => ({ ...current, addressZh: event.target.value }))} />
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
                onChange={(event) =>
                  setVenueDraft((current) => ({ ...current, peakPrice: event.target.value }))
                }
              />
            </div>
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
                onChange={(event) =>
                  setVenueDraft((current) => ({ ...current, offPeakPrice: event.target.value }))
                }
              />
            </div>
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
            onChange={(event) => setVenueDraft((current) => ({ ...current, notes: event.target.value }))}
            className="native-textarea"
            rows={2}
            placeholder={t.venueNotes}
          />
        </div>
        {adminMessage ? (
          <div className="admin-message">
            <Check size={15} /> {adminMessage}
          </div>
        ) : null}
        <Button type="submit" disabled={adminBusy}>
          <Check size={16} /> {adminBusy ? t.saving : t.saveVenue}
        </Button>
      </form>
    );
  }

  function renderSessionCalendar() {
    return (
      <div className="session-calendar">
        <div className="session-calendar-toolbar">
          <Button variant="outline" size="sm" onClick={() => setCalendarDate(shiftDate(calendarDate, -7))}>
            <ArrowLeft size={14} />
          </Button>
          <strong>
            {formatDate(calendarDays[0], language)} – {formatDate(calendarDays[6], language)}
          </strong>
          <Button variant="outline" size="sm" onClick={() => setCalendarDate(shiftDate(calendarDate, 7))}>
            <ArrowRight size={14} />
          </Button>
        </div>
        <div className="session-calendar-grid">
          {calendarDays.map((date) => {
            const daySessions = adminSessions.filter((session) => session.date === date);
            return (
              <div className="session-calendar-day" key={date}>
                <h3>{formatDate(date, language)}</h3>
                {daySessions.length ? (
                  daySessions.map((session) => (
                    <button
                      type="button"
                      className={`session-calendar-item ${session.status}`}
                      key={session.id}
                      onClick={() => onStartEditSession(session)}
                    >
                      <strong>
                        {session.startTime}–{session.endTime}
                      </strong>
                      <span>{getVenue(session.venueId, venueList).name}</span>
                      <small>{session.status === 'published' ? t.published : t.draft}</small>
                    </button>
                  ))
                ) : (
                  <span className="session-calendar-empty">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">
            <Settings2 size={14} /> {t.admin}
          </p>
          <h1>{t.adminTitle}</h1>
          <p>{t.adminIntro}</p>
        </div>
        <div className="admin-heading-actions">
          <Button variant="outline" onClick={onResetDemo} disabled={adminBusy}>
            <RefreshCw size={15} /> {t.resetDemo}
          </Button>
          <Button variant="ghost" onClick={onLogoutAdmin} disabled={adminBusy}>
            {t.logout}
          </Button>
        </div>
      </div>
      <div className="admin-setting-card">
        <div>
          <strong>{t.racketRentalSetting}</strong>
          <p>{racketRentalEnabled ? t.racketRentalEnabled : t.racketRentalDisabled}</p>
        </div>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={racketRentalEnabled}
            disabled={racketRentalBusy || adminBusy}
            aria-label={t.updateRacketRental}
            onChange={(event) => onUpdateRacketRental(event.target.checked)}
          />
          <span aria-hidden="true" />
        </label>
      </div>
      <div className="admin-stats">
        <div>
          <span>{publishedCount}</span>
          <small>{t.published}</small>
        </div>
        <div>
          <span>{activeBookings.length}</span>
          <small>{t.activeBookings}</small>
        </div>
        <div>
          <span>{openSpots}</span>
          <small>{t.spotsLeft}</small>
        </div>
      </div>
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <div className="admin-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={adminTab === 'sessions'}
              className={adminTab === 'sessions' ? 'active' : ''}
              onClick={() => setAdminTab('sessions')}
            >
              {t.manageSessions}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={adminTab === 'bookings'}
              className={adminTab === 'bookings' ? 'active' : ''}
              onClick={() => setAdminTab('bookings')}
            >
              {t.viewBookings}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={adminTab === 'requests'}
              className={adminTab === 'requests' ? 'active' : ''}
              onClick={() => setAdminTab('requests')}
            >
              {t.manageRequests}
              {reservationRequests.filter((request) => request.status === 'pending').length
                ? ` (${reservationRequests.filter((request) => request.status === 'pending').length})`
                : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={adminTab === 'venues'}
              className={adminTab === 'venues' ? 'active' : ''}
              onClick={() => setAdminTab('venues')}
            >
              {t.manageVenues}
            </button>
          </div>
        </aside>
        <div className="admin-main-content">
          {adminTab === 'sessions' ? (
            <div className={`admin-session-layout${sessionEditorOpen ? '' : ' session-layout-full'}`}>
              <div className="admin-session-list">
                <div className="admin-list-heading">
                  <div>
                    <p className="eyebrow muted">{t.sessions}</p>
                    <h2>{showExpiredSessions ? t.expiredSessions : t.upcoming}</h2>
                  </div>
                  <div className="admin-session-import-actions">
                    <Badge variant="secondary">{adminSessions.length}</Badge>
                    <Button
                      variant={sessionView === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSessionView('list')}
                      disabled={adminBusy}
                    >
                      {t.sessionTableView}
                    </Button>
                    <Button
                      variant={sessionView === 'week' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSessionView('week')}
                      disabled={adminBusy}
                    >
                      {t.sessionCalendarView}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onExportSessions} disabled={adminBusy}>
                      <Download size={14} /> {t.exportSessions}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDraft(emptyDraft(venueList));
                        setSessionEditorOpen(true);
                      }}
                      disabled={adminBusy}
                    >
                      <Plus size={14} /> {t.addSession}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onUndoLastOperation}
                      disabled={adminBusy || !undoSessions}
                    >
                      <RefreshCw size={14} /> {t.undo}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowExpiredSessions((current) => !current)}
                      disabled={adminBusy}
                    >
                      <Timer size={14} />{' '}
                      {showExpiredSessions ? t.hideExpiredSessions : t.viewExpiredSessions}
                    </Button>
                    <a
                      className={buttonVariants({
                        variant: 'outline',
                        className: 'admin-template-download',
                      })}
                      href="/session-import-template.xlsx"
                      download
                    >
                      <Download size={14} /> {t.downloadSessionTemplate}
                    </a>
                    <input
                      ref={sessionImportInput}
                      className="sr-only"
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      aria-label={t.importSessions}
                      onChange={onImportSessions}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sessionImportInput.current?.click()}
                      disabled={adminBusy}
                    >
                      <Upload size={14} /> {adminBusy ? t.importingSessions : t.importSessions}
                    </Button>
                  </div>
                </div>
                <p className="admin-session-import-help">{t.sessionImportHelp}</p>
                {sessionImportMessage ? (
                  <div
                    className={`admin-message${sessionImportFailed ? ' import-error' : ''}`}
                    role="status"
                  >
                    {sessionImportMessage}
                  </div>
                ) : null}
                <div className="admin-session-filters">
                  <label>
                    {t.sessionDateFilter}
                    <select
                      value={sessionDateFilter}
                      onChange={(event) => setSessionDateFilter(event.target.value)}
                      className="native-select"
                    >
                      <option value="">{t.allDates}</option>
                      {[...new Set(allSessions.map((session) => session.date))].sort().map((date) => (
                        <option key={date} value={date}>
                          {formatDate(date, language)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t.sessionVenueFilter}
                    <select
                      value={sessionVenueFilter}
                      onChange={(event) => setSessionVenueFilter(event.target.value)}
                      className="native-select"
                    >
                      <option value="">{t.allVenues}</option>
                      {venueList.map((venue) => (
                        <option key={venue.id} value={venue.id}>
                          {venue.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t.sessionStatusFilter}
                    <select
                      value={sessionStatusFilter}
                      onChange={(event) =>
                        setSessionStatusFilter(event.target.value as SessionStatus | '')
                      }
                      className="native-select"
                    >
                      <option value="">{t.allStatuses}</option>
                      <option value="published">{t.published}</option>
                      <option value="draft">{t.draft}</option>
                    </select>
                  </label>
                </div>
                {selectedSessionIds.length ? (
                  <div className="admin-bulk-actions">
                    <span>{t.selectedSessions.replace('{count}', String(selectedSessionIds.length))}</span>
                    <Button
                      size="sm"
                      onClick={() => onBulkUpdateSessionStatus('published')}
                      disabled={adminBusy}
                    >
                      <Check size={14} /> {t.publishSelected}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onBulkUpdateSessionStatus('draft')}
                      disabled={adminBusy}
                    >
                      <Pencil size={14} /> {t.draftSelected}
                    </Button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setSelectedSessionIds([])}
                    >
                      {t.clearSelection}
                    </button>
                  </div>
                ) : null}
                {sessionView === 'week' ? (
                  renderSessionCalendar()
                ) : (
                  <div className="session-table-wrap">
                    <table className="session-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              aria-label={t.selectAll}
                              checked={
                                adminSessions.length > 0 &&
                                adminSessions.every((session) => selectedSessionIds.includes(session.id))
                              }
                              onChange={(event) =>
                                setSelectedSessionIds(
                                  event.target.checked
                                    ? adminSessions.map((session) => session.id)
                                    : [],
                                )
                              }
                            />
                          </th>
                          <th>{t.date}</th>
                          <th>{t.location}</th>
                          <th>{t.time}</th>
                          <th>{t.status}</th>
                          <th>{t.capacity}</th>
                          <th>{t.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminSessions.map((session) => {
                          const venue = getVenue(session.venueId, venueList);
                          const spots = Math.max(0, session.capacity - session.bookedSpots);
                          return (
                            <tr key={session.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedSessionIds.includes(session.id)}
                                  onChange={(event) =>
                                    setSelectedSessionIds((current) =>
                                      event.target.checked
                                        ? [...current, session.id]
                                        : current.filter((id) => id !== session.id),
                                    )
                                  }
                                />
                              </td>
                              <td>
                                <strong>{formatDate(session.date, language)}</strong>
                              </td>
                              <td>{venue.name}</td>
                              <td>
                                {session.startTime}–{session.endTime}
                              </td>
                              <td>
                                <Badge
                                  variant={session.status === 'published' ? 'default' : 'outline'}
                                >
                                  {session.status === 'published' ? t.published : t.draft}
                                </Badge>
                              </td>
                              <td>
                                {session.bookedSpots}/{session.capacity} · {spots} {t.spotsLeft}
                              </td>
                              <td>
                                <div className="admin-row-actions">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onStartEditSession(session)}
                                    disabled={adminBusy}
                                  >
                                    <Pencil size={14} /> {t.edit}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onCreateRecurringSessions(session)}
                                    disabled={adminBusy}
                                  >
                                    <Repeat2 size={14} /> {t.createNextWeeks}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => onDeleteSession(session)}
                                    disabled={adminBusy}
                                  >
                                    <Trash2 size={14} /> {t.delete}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {!adminSessions.length ? <div className="empty-state">{t.noSessions}</div> : null}
              </div>
              {sessionEditorOpen ? renderSessionEditor() : null}
            </div>
          ) : adminTab === 'bookings' ? (
            <div className="admin-bookings">
              <div className="admin-list-heading">
                <div>
                  <p className="eyebrow muted">{t.admin}</p>
                  <h2>{t.bookingList}</h2>
                  <p>{t.bookingListIntro}</p>
                </div>
                <Badge variant="secondary">{bookings.length}</Badge>
              </div>
              {bookings.length ? (
                <div className="booking-table-wrap">
                  <table className="booking-table">
                    <thead>
                      <tr>
                        <th>{t.contact}</th>
                        <th>{t.sessions}</th>
                        <th>{t.format}</th>
                        <th>{t.participants}</th>
                        <th>{t.total}</th>
                        <th>{t.status}</th>
                        <th scope="col">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => {
                        const session = sessions.find((item) => item.id === booking.sessionId);
                        const venue = session
                          ? getVenue(session.venueId, venueList)
                          : getVenue(venueList[0].id, venueList);
                        return (
                          <tr key={booking.id}>
                            <td>
                              <strong>{booking.contactName}</strong>
                              <span>{booking.email}</span>
                              {booking.phone ? <span>{booking.phone}</span> : null}
                            </td>
                            <td>
                              <strong>{venue.name}</strong>
                              <span>{session ? formatDate(session.date, language) : ''}</span>
                            </td>
                            <td>
                              <strong>{formatNames([booking.format], t)}</strong>
                            </td>
                            <td>
                              <strong>
                                {booking.participants.length}{' '}
                                {booking.participants.length === 1 ? t.person : t.people}
                              </strong>
                              <span>{booking.participants.join(' · ')}</span>
                            </td>
                            <td>{formatMoney(booking.totalPence, language)}</td>
                            <td>
                              <Badge variant={booking.status === 'confirmed' ? 'default' : 'outline'}>
                                {bookingStatusLabel(booking.status, t)}
                              </Badge>
                            </td>
                            <td>
                              {booking.status === 'confirmed' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onCancelBooking(booking.id)}
                                  disabled={adminBusy}
                                >
                                  {t.cancelBooking}
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">{t.emptyBookings}</div>
              )}
            </div>
          ) : adminTab === 'requests' ? (
            <div className="admin-bookings admin-requests">
              <div className="admin-list-heading">
                <div>
                  <p className="eyebrow muted">{t.manageRequests}</p>
                  <h2>{t.requestList}</h2>
                  <p>{t.requestListIntro}</p>
                </div>
                <Badge variant="secondary">{reservationRequests.length}</Badge>
              </div>
              {adminMessage ? <div className="admin-message">{adminMessage}</div> : null}
              {reservationRequests.length ? (
                <div className="request-admin-list">
                  {reservationRequests.map((request) => {
                    const venue = request.venueId ? getVenue(request.venueId, venueList) : null;
                    const requestLocation =
                      request.requestType === 'find_nearby'
                        ? `${request.postcode} · ${t.specifiedVenueNo}`
                        : venue
                          ? venueLabel(venue)
                          : request.venueName;
                    return (
                      <article className="request-admin-row" key={request.id}>
                        <div className="request-admin-date">
                          <strong>{new Date(`${request.preferredDate}T12:00:00`).getDate()}</strong>
                          <span>
                            {new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
                              month: 'short',
                            }).format(new Date(`${request.preferredDate}T12:00:00`))}
                          </span>
                        </div>
                        <div className="request-admin-main">
                          <div className="request-admin-title">
                            <strong>{requestLocation}</strong>
                            <Badge variant={request.status === 'pending' ? 'default' : 'outline'}>
                              {requestStatusLabel(request.status, t)}
                            </Badge>
                          </div>
                          <span>
                            <CalendarDays size={14} /> {formatLongDate(request.preferredDate, language)} ·{' '}
                            {request.startTime}–{request.endTime}
                          </span>
                          <span>
                            <UserRound size={14} /> {request.contactName} ·{' '}
                            <a href={`mailto:${request.email}`}>{request.email}</a>
                            {request.phone ? ` · ${request.phone}` : ''}
                          </span>
                          {request.message ? <p>{request.message}</p> : null}
                          <small>
                            {t.requestedOn}:{' '}
                            {new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            }).format(new Date(request.createdAt))}
                          </small>
                        </div>
                        <div className="request-admin-actions">
                          <div className="request-admin-status">
                            <Label htmlFor={`request-status-${request.id}`}>{t.status}</Label>
                            <select
                              id={`request-status-${request.id}`}
                              className="native-select"
                              value={request.status}
                              disabled={adminBusy}
                              onChange={(event) => onUpdateReservationRequestStatus(request.id, event.target.value as ReservationRequestStatus)}
                            >
                              <option value="pending">{t.pendingRequest}</option>
                              <option value="reviewing">{t.reviewingRequest}</option>
                              <option value="completed">{t.completedRequest}</option>
                              <option value="cancelled">{t.cancelled}</option>
                            </select>
                          </div>
                          {request.status !== 'cancelled' ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={adminBusy}
                              onClick={() => onUpdateReservationRequestStatus(request.id, 'cancelled')}
                            >
                              {t.cancelRequest}
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">{t.noRequests}</div>
              )}
            </div>
          ) : (
            <div className={`admin-venue-layout${venueEditorOpen ? '' : ' venue-layout-full'}`}>
              <div className="admin-venue-list">
                <div className="admin-list-heading">
                  <div>
                    <p className="eyebrow muted">{t.manageVenues}</p>
                    <h2>{t.venueList}</h2>
                    <p>{t.venueListIntro}</p>
                  </div>
                  <div className="admin-list-heading-actions">
                    <Badge variant="secondary">{venueList.length}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVenueDraft(emptyVenueDraft(venueList));
                        setVenueEditorOpen(true);
                      }}
                      disabled={adminBusy}
                    >
                      <Plus size={14} /> {t.addVenue}
                    </Button>
                  </div>
                </div>
                {venueList.map((venue) => (
                  <div className="admin-venue-row" key={venue.id}>
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
                      <span>{venue.area}</span>
                      <small>
                        {t.peakPrice}: {formatMoney(venue.peakPricePence, language)} · {t.offPeakPrice}:{' '}
                        {formatMoney(venue.offPeakPricePence, language)}
                      </small>
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
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeleteVenue(venue)}
                        disabled={adminBusy}
                      >
                        <Trash2 size={14} /> {t.delete}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {venueEditorOpen ? renderVenueEditor() : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
