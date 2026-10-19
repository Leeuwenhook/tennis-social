'use client';

import { useState } from 'react';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';

import { slotLabels } from '@/lib/partner-request-slots';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AdminPasteRequests } from '@/components/admin/admin-paste-requests';
import {
  formatLongDate,
  requestStatusLabel,
} from '@/lib/formatters';
import { getVenue, venueLabel } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type {
  ReservationRequest,
  ReservationRequestStatus,
} from '@/types/tennis';

import type { AdminViewProps } from '@/components/admin/admin-view';

type AdminApplication = {
  id: string;
  name?: string;
  contact_name?: string;
  email: string;
  phone?: string | null;
  wechat?: string; whatsapp?: string; preferred_contact?: string;
  tennis_level?: string;
  preferred_format?: string;
  message?: string | null;
  status: 'pending' | 'accepted' | 'rejected';
};

function preferredFormatLabel(format: string | undefined, t: Translations) {
  if (format === 'singles') return t.singles;
  if (format === 'doubles') return t.doubles;
  if (format === 'practice') return t.practice;
  if (!format || format === 'flexible') return t.flexible;
  return format;
}

function AdminRequestApplications({ request, t }: { request: ReservationRequest; t: Translations }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  async function fetchApplications(keepError = false) {
    setLoading(true);
    if (!keepError) setError('');
    try {
      const response = await fetch(`/api/admin/reservation-requests/${encodeURIComponent(request.id)}/applications`, { cache: 'no-store' });
      if (response.status === 401) { setError(t.adminSessionExpired); return; }
      const data = await response.json() as { applications?: AdminApplication[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'applications_unavailable');
      setApplications(data.applications ?? []);
    } catch { setError(t.requestApplicationsLoadFailed); }
    finally { setLoading(false); }
  }

  function toggleApplications() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (!loading) void fetchApplications();
  }

  async function updateApplication(application: AdminApplication, status: AdminApplication['status']) {
    if (application.status === status || updating) return;
    if (status === 'accepted' && application.status !== 'accepted' && request.seekingPlayerCount) {
      const acceptedCount = applications.filter((item) => item.status === 'accepted').length;
      if (acceptedCount >= request.seekingPlayerCount) { setError(t.requestAlreadyFull); return; }
      if (acceptedCount + 1 === request.seekingPlayerCount && !window.confirm(t.acceptLastApplicationConfirm)) return;
    }
    setUpdating(application.id); setError('');
    try {
      const response = await fetch(`/api/admin/reservation-requests/${encodeURIComponent(request.id)}/applications/${encodeURIComponent(application.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (response.status === 401) { setError(t.adminSessionExpired); return; }
      const data = await response.json().catch(() => ({})) as { application?: AdminApplication; error?: string };
      if (response.status === 409 && data.error === 'request_full') { setError(t.requestAlreadyFull); void fetchApplications(true); return; }
      if (response.status === 409 && data.error === 'request_closed') { setError(t.requestClosedForApplications); return; }
      if (!response.ok || !data.application) throw new Error(data.error || 'application_unavailable');
      setApplications((current) => current.map((item) => item.id === application.id ? data.application as AdminApplication : item));
    } catch { setError(t.requestApplicationUpdateFailed); }
    finally { setUpdating(null); }
  }

  const kindLabel = request.requestKind === 'find_partners' ? t.requestKindFindPartners : request.requestKind === 'find_both' ? t.requestKindFindBoth : t.requestKindFindCourt;
  const formatLabel = preferredFormatLabel(request.preferredFormat, t);

  return (
    <div className="request-admin-details">
      <div className="request-admin-structured">
        <span><strong>{t.requestKind}:</strong> {kindLabel}</span>
        <span><strong>{t.existingPlayers}:</strong> {request.existingPlayerLevels?.length ? request.existingPlayerLevels.join(' · ') : t.none}</span>
        <span><strong>{t.seekingPlayers}:</strong> {request.seekingPlayerCount ?? 0}</span>
        <span><strong>{t.seekingLevels}:</strong> {request.seekingLevels?.length ? request.seekingLevels.join(' · ') : t.none}</span>
        <span><strong>{t.format}:</strong> {formatLabel}</span>
        <span><strong>{t.venueBookingStatus}:</strong> {request.venueBookingStatus === 'booked' ? t.venueBooked : request.venueBookingStatus === 'not_booked' ? t.notBooked : t.unknown}</span>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={toggleApplications} disabled={loading}>
        {loading ? t.loadingApplications : open ? t.hideApplications : t.viewApplications}
      </Button>
      {open ? (
        <div className="request-admin-applications">
          <Button type="button" variant="ghost" size="sm" onClick={() => void fetchApplications()} disabled={loading || updating !== null}>
            <RefreshCw size={14} /> {t.refreshApplications}
          </Button>
          {error ? <div className="inline-error">{error}</div> : null}
          {loading ? <p className="admin-muted">{t.loadingApplications}</p> : applications.length ? applications.map((application) => (
            <div className="request-admin-application" key={application.id}>
              <div>
                <strong>{application.name ?? application.contact_name ?? t.unknown}</strong>
                <span><a href={`mailto:${application.email}`}>{application.email}</a>{application.phone ? ` · ${application.phone}` : ''} · {t.wechat}: {application.wechat || '—'} · {t.whatsapp}: {application.whatsapp || '—'} · {t.preferredContact}: <strong>{application.preferred_contact ?? 'email'}</strong></span>
                <span>{application.tennis_level || t.unknown} · {preferredFormatLabel(application.preferred_format, t)}</span>
                {application.message ? <small>{application.message}</small> : null}
              </div>
              <div className="request-admin-application-actions" role="group" aria-label={`${t.applicationStatusGroup}: ${application.name ?? application.contact_name ?? application.email}`}>
                {(['pending', 'accepted', 'rejected'] as const).map((status) => (
                  <Button key={status} type="button" size="sm" variant={application.status === status ? 'default' : 'outline'} aria-pressed={application.status === status} disabled={updating !== null} onClick={() => void updateApplication(application, status)}>
                    {status === 'pending' ? t.pendingApplication : status === 'accepted' ? t.acceptedApplication : t.rejectedApplication}
                  </Button>
                ))}
              </div>
            </div>
          )) : !loading ? <p className="admin-muted">{t.noApplications}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AdminRequestsTab(props: AdminViewProps) {
  const {
  venueList,
  reservationRequests,
  adminBusy,
  adminMessage,
  language,
  t,
  onUpdateReservationRequestStatus,
  onReservationRequestCreated,
  } = props;


  return (
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
              <AdminPasteRequests venueList={venueList} t={t} onCreated={onReservationRequestCreated} />
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
                            {request.venueBookingStatus === 'booked' && request.startTime && request.endTime ? `${request.startTime}–${request.endTime}` : slotLabels(request.preferredSlots, language)}
                          </span>
                          <span>
                            <UserRound size={14} /> {request.contactName} ·{' '}
                            <a href={`mailto:${request.email}`}>{request.email}</a> · {t.preferredContact}: <strong>{request.preferredContact ?? 'email'}</strong> · {t.wechat}: {request.wechat || '—'} · {t.whatsapp}: {request.whatsapp || '—'}
                            {request.phone ? ` · ${request.phone}` : ''}
                          </span>
                          {request.message ? <p>{request.message}</p> : null}
                          <AdminRequestApplications request={request} t={t} />
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
  );
}
