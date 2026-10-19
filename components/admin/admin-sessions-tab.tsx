'use client';

import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminSessionRows } from '@/components/admin/admin-session-rows';
import { AdminSessionToolbar } from '@/components/admin/admin-session-toolbar';
import { GAME_FORMATS } from '@/lib/demo-data';
import {
  formatDate,
  formatNames,
} from '@/lib/formatters';
import { emptyDraft, getVenue, LEVELS, shiftDate } from '@/lib/tennis-utils';
import type {
  SessionStatus,
} from '@/types/tennis';

import type { AdminViewProps } from '@/components/admin/admin-view';

export function AdminSessionsTab(props: AdminViewProps) {
  const {
  adminSessions,
  allSessions,
  venueList,
  bookings,
  adminBusy,
  adminMessage,
  sessionEditorOpen,
  setSessionEditorOpen,
  draft,
  setDraft,
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
  onSaveDraft,
  onApplyVenueDefaultPrice,
  onStartEditSession,
  onCreateRecurringSessions,
  onDeleteSession,
  onSetSessionFull,
  onBulkUpdateSessionStatus,
  onExportSessions,
  onUndoLastOperation,
  onImportSessions,
  } = props;

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
              min="0"
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
            <div className={`admin-session-layout${sessionEditorOpen ? '' : ' session-layout-full'}`}>
              <div className="admin-session-list">
                <div className="admin-list-heading">
                  <div>
                    <p className="eyebrow muted">{t.sessions}</p>
                    <h2>{showExpiredSessions ? t.expiredSessions : t.upcoming}</h2>
                  </div>
                  <AdminSessionToolbar
                    language={language}
                    t={t}
                    adminBusy={adminBusy}
                    sessionView={sessionView}
                    setSessionView={setSessionView}
                    showExpiredSessions={showExpiredSessions}
                    setShowExpiredSessions={setShowExpiredSessions}
                    canUndo={Boolean(undoSessions)}
                    importInput={sessionImportInput}
                    onAdd={() => {
                      setDraft(emptyDraft(venueList));
                      setSessionEditorOpen(true);
                    }}
                    onImport={onImportSessions}
                    onExport={onExportSessions}
                    onUndo={onUndoLastOperation}
                  />
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
                  <AdminSessionRows
                    sessions={adminSessions}
                    venueList={venueList}
                    bookings={bookings}
                    selectedSessionIds={selectedSessionIds}
                    setSelectedSessionIds={setSelectedSessionIds}
                    adminBusy={adminBusy}
                    language={language}
                    t={t}
                    onEdit={onStartEditSession}
                    onCreateRecurring={onCreateRecurringSessions}
                    onSetFull={onSetSessionFull}
                    onDelete={onDeleteSession}
                  />
                )}
                {!adminSessions.length ? <div className="empty-state">{t.noSessions}</div> : null}
              </div>
              {sessionEditorOpen ? renderSessionEditor() : null}
            </div>
  );
}
