'use client';

import type { ChangeEvent, RefObject, SubmitEvent } from 'react';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminAuditLog } from '@/components/admin/admin-audit-log';
import { AdminBookings } from '@/components/admin/admin-bookings';
import { AdminOverview } from '@/components/admin/admin-overview';
import { AdminRequestsTab } from '@/components/admin/admin-requests-tab';
import { AdminSessionsTab } from '@/components/admin/admin-sessions-tab';
import { AdminVenuesTab } from '@/components/admin/admin-venues-tab';
import { AdminReviews } from '@/components/admin/admin-reviews';
import type { Venue } from '@/lib/demo-data';
import type { Translations } from '@/lib/translations';
import type {
  AdminTab,
  Booking,
  BookingStatus,
  Language,
  ReservationRequest,
  ReservationRequestStatus,
  Session,
  SessionDraft,
  SessionStatus,
  VenueDraft,
} from '@/types/tennis';

export type AdminViewProps = {
  adminAuthChecked: boolean;
  adminAuthenticated: boolean;
  adminAuthBusy: boolean;
  adminAuthError: string;
  adminLogin: { username: string; password: string };
  setAdminLogin: React.Dispatch<React.SetStateAction<{ username: string; password: string }>>;
  onSubmitAdminLogin: (e: SubmitEvent<HTMLFormElement>) => void;
  adminTab: AdminTab;
  setAdminTab: (tab: AdminTab) => void;
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
  sessionImportInput: RefObject<HTMLInputElement | null>;
  sessionImportMessage: string;
  sessionImportFailed: boolean;
  language: Language;
  t: Translations;
  onLogoutAdmin: () => void;
  onSaveDraft: (e: SubmitEvent<HTMLFormElement>) => void;
  onSaveVenue: (e: SubmitEvent<HTMLFormElement>) => void;
  onChooseVenueImage: (e: ChangeEvent<HTMLInputElement>) => void;
  onReuseVenuePhoto: () => void;
  onApplyVenueDefaultPrice: (kind: 'peak' | 'offPeak') => void;
  onStartEditSession: (session: Session) => void;
  onCreateRecurringSessions: (session: Session) => void;
  onDeleteSession: (session: Session) => void;
  onSetSessionFull: (session: Session, markedFull: boolean) => void;
  onBulkUpdateSessionStatus: (status: SessionStatus) => void;
  onExportSessions: () => void;
  /** Something changed on the server outside this view (an undo); reload. */
  onDataChanged: () => void;
  onImportSessions: (e: ChangeEvent<HTMLInputElement>) => void;
  onBookingChanged: (id: string, status: BookingStatus) => void;
  onUpdateReservationRequestStatus: (id: string, status: ReservationRequestStatus) => void;
  onReservationRequestCreated: (request: ReservationRequest) => void;
  onStartEditVenue: (venue: Venue) => void;
  onDeleteVenue: (venue: Venue) => void;
};

export function AdminView(props: AdminViewProps) {
  const {
    onDataChanged,
  adminAuthChecked,
  adminAuthenticated,
  adminAuthBusy,
  adminAuthError,
  adminLogin,
  setAdminLogin,
  onSubmitAdminLogin,
  adminTab,
  setAdminTab,
  venueList,
  activeBookings,
  reservationRequests,
  publishedCount,
  openSpots,
  racketRentalEnabled,
  racketRentalBusy,
  onUpdateRacketRental,
  adminBusy,
  language,
  t,
  onLogoutAdmin,
  onBookingChanged,
  } = props;
  const pendingRequests = reservationRequests.filter((request) => request.status === 'pending').length;
  const adminTabs: Array<{ id: AdminTab; label: string }> = [
    { id: 'overview', label: language === 'zh' ? '概览' : 'Overview' },
    { id: 'sessions', label: t.manageSessions },
    { id: 'bookings', label: t.viewBookings },
    { id: 'requests', label: pendingRequests ? `${t.manageRequests} (${pendingRequests})` : t.manageRequests },
    { id: 'reviews', label: language === 'zh' ? '评价审核' : 'Reviews' },
    { id: 'venues', label: t.manageVenues },
    { id: 'audit', label: language === 'zh' ? '操作记录' : 'Activity' },
  ];

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




  return (
    <section className="admin-page admin-page-wide">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">
            <Settings2 size={14} /> {t.admin}
          </p>
          <h1>{t.adminTitle}</h1>
          <p>{t.adminIntro}</p>
        </div>
        <div className="admin-heading-actions">
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
      {adminTab === 'sessions' ? <div className="admin-stats">
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
      : null}
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <select
            className="native-select admin-tab-select"
            aria-label={t.admin}
            value={adminTab}
            onChange={(event) => setAdminTab(event.target.value as AdminTab)}
          >
            {adminTabs.map((tab) => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
          <div className="admin-tabs" role="tablist">
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={adminTab === tab.id}
                className={adminTab === tab.id ? 'active' : ''}
                onClick={() => setAdminTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </aside>
        <div className="admin-main-content">
          {adminTab === 'sessions' ? (
            <AdminSessionsTab {...props} />
          ) : adminTab === 'overview' ? (
            <AdminOverview language={language} onOpenTab={setAdminTab} />
          ) : adminTab === 'bookings' ? (
            <AdminBookings language={language} venueList={venueList} onBookingChanged={onBookingChanged} />
          ) : adminTab === 'requests' ? (
            <AdminRequestsTab {...props} />
          ) : adminTab === 'reviews' ? (
            <AdminReviews language={language} />
          ) : (
            adminTab === 'audit' ? <AdminAuditLog language={language} onChanged={onDataChanged} /> : <AdminVenuesTab {...props} />
          )}
        </div>
      </div>
    </section>
  );
}
