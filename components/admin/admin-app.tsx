'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type SubmitEvent } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import Globe from 'lucide-react/dist/esm/icons/globe.mjs';

import { AppMark } from '@/components/app-mark';
import { AdminView } from '@/components/admin/admin-view';
import { venues, type Venue } from '@/lib/demo-data';
import { importIssueLabel, parseMinutes } from '@/lib/formatters';
import { parseSessionWorkbook, SessionImportError } from '@/lib/session-import';
import {
  availableSpots,
  dateFromToday,
  emptyDraft,
  emptyVenueDraft,
  getVenue,
  isPast,
  LANGUAGE_STORAGE_KEY,
  normalizeBooking,
  normalizeFormats,
  normalizeSession,
  normalizeVenue,
  sessionPayload,
  sessionSort,
  shiftDate,
  validFormats,
  weekStart,
} from '@/lib/tennis-utils';
import { translations } from '@/lib/translations';
import type {
  AdminTab,
  Booking,
  BookingStatus,
  Language,
  ReservationRequest,
  ReservationRequestStatus,
  Session,
  SessionDraft,
  SessionImportIssueCode,
  SessionStatus,
  VenueDraft,
} from '@/types/tennis';

/** The admin keeps its own language choice, separate from the public site. */
const ADMIN_LANGUAGE_STORAGE_KEY = 'tennis-match-admin-language';
/** Expired sessions older than this are only loaded when the admin asks for them. */
const RECENT_DAYS = 30;

function readAdminLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY) ?? window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === 'zh' ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * The admin portal at /admin. It is separate from the public site: it owns
 * its sign-in, data and language, and the public page bundle does not include it.
 */
export function AdminApp() {
  const [language, setLanguage] = useState<Language>('en');
  const [venueList, setVenueList] = useState<Venue[]>(venues);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reservationRequests, setReservationRequests] = useState<ReservationRequest[]>([]);
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [showExpiredSessions, setShowExpiredSessions] = useState(false);
  const [sessionEditorOpen, setSessionEditorOpen] = useState(false);
  const [venueEditorOpen, setVenueEditorOpen] = useState(false);
  const [sessionDateFilter, setSessionDateFilter] = useState('');
  const [sessionVenueFilter, setSessionVenueFilter] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<SessionStatus | ''>('');
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [sessionView, setSessionView] = useState<'list' | 'week'>('list');
  const [calendarDate, setCalendarDate] = useState(() => dateFromToday(0));
  const [draft, setDraft] = useState<SessionDraft>(() => emptyDraft(venues));
  const [venueDraft, setVenueDraft] = useState<VenueDraft>(() => emptyVenueDraft(venues));
  const [adminMessage, setAdminMessage] = useState('');
  const [sessionImportMessage, setSessionImportMessage] = useState('');
  const [sessionImportFailed, setSessionImportFailed] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [racketRentalEnabled, setRacketRentalEnabled] = useState(false);
  const [racketRentalBusy, setRacketRentalBusy] = useState(false);
  const sessionImportInput = useRef<HTMLInputElement>(null);
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [adminAuthBusy, setAdminAuthBusy] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminLogin, setAdminLogin] = useState({ username: '', password: '' });
  const [dataVersion, setDataVersion] = useState(0);
  const sessionLoadVersion = useRef(0);
  const adminBusyRef = useRef(false);
  const t = translations[language];

  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- read the saved language after mount to keep SSR markup consistent
    setLanguage(readAdminLanguage());
    let cancelled = false;
    fetch('/api/admin/auth/session', { cache: 'no-store' })
      .then((response) => {
        if (!cancelled) setAdminAuthenticated(response.ok);
      })
      .catch(() => {
        if (!cancelled) setAdminAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setAdminAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    try {
      window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The choice simply is not remembered.
    }
  }, [language]);

  // Settings, venues and requests are small and needed across tabs.
  useEffect(() => {
    if (!adminAuthenticated) return;
    let cancelled = false;
    const get = async <T,>(url: string): Promise<T | null> => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.status === 401) {
          if (!cancelled) setAdminAuthenticated(false);
          return null;
        }
        return response.ok ? ((await response.json()) as T) : null;
      } catch {
        return null;
      }
    };
    void get<{ racketRentalEnabled?: unknown }>('/api/admin/settings').then((data) => {
      if (!cancelled && typeof data?.racketRentalEnabled === 'boolean') setRacketRentalEnabled(data.racketRentalEnabled);
    });
    void get<{ venues?: unknown[] }>('/api/admin/venues').then((data) => {
      const next = data?.venues?.map(normalizeVenue).filter((venue): venue is Venue => Boolean(venue)) ?? [];
      if (!cancelled && next.length) setVenueList(next);
    });
    void get<{ requests?: ReservationRequest[] }>('/api/admin/reservation-requests').then((data) => {
      if (!cancelled && data?.requests) setReservationRequests(data.requests);
    });
    return () => {
      cancelled = true;
    };
  }, [adminAuthenticated, dataVersion]);

  // Sessions and their bookings: upcoming plus the last 30 days, or everything
  // once the admin asks to see expired sessions.
  useEffect(() => {
    if (!adminAuthenticated) return;
    let cancelled = false;
    const version = ++sessionLoadVersion.current;
    const from = showExpiredSessions ? '' : `?from=${shiftDate(dateFromToday(0), -RECENT_DAYS)}`;
    void (async () => {
      try {
        const [sessionResponse, bookingResponse] = await Promise.all([
          fetch(`/api/admin/sessions${from}`, { cache: 'no-store' }),
          fetch(`/api/admin/bookings${from}`, { cache: 'no-store' }),
        ]);
        if (cancelled || version !== sessionLoadVersion.current) return;
        if (sessionResponse.status === 401 || bookingResponse.status === 401) {
          setAdminAuthenticated(false);
          return;
        }
        if (!sessionResponse.ok) throw new Error('sessions_unavailable');
        const sessionData = (await sessionResponse.json()) as { sessions?: Session[] };
        const bookingData = bookingResponse.ok ? ((await bookingResponse.json()) as { bookings?: Booking[] }) : {};
        if (cancelled || version !== sessionLoadVersion.current) return;
        setSessions((sessionData.sessions ?? []).map(normalizeSession));
        if (bookingData.bookings) setBookings(bookingData.bookings.map(normalizeBooking));
      } catch {
        if (!cancelled) setAdminMessage(translations[readAdminLanguage()].adminSessionsUnavailable);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminAuthenticated, showExpiredSessions, dataVersion]);

  // Reload when the admin comes back to the tab, unless a save is in flight.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !adminBusyRef.current) setDataVersion((value) => value + 1);
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const allSessions = useMemo(() => [...sessions].sort(sessionSort), [sessions]);
  const upcomingSessions = useMemo(() => allSessions.filter((session) => session.status === 'published' && !isPast(session)), [allSessions]);
  const adminSessions = useMemo(
    () => allSessions.filter((session) => {
      if (!showExpiredSessions && isPast(session)) return false;
      if (sessionDateFilter && session.date !== sessionDateFilter) return false;
      if (sessionVenueFilter && session.venueId !== sessionVenueFilter) return false;
      if (sessionStatusFilter && session.status !== sessionStatusFilter) return false;
      return true;
    }),
    [allSessions, sessionDateFilter, sessionStatusFilter, sessionVenueFilter, showExpiredSessions],
  );
  const calendarWeekStart = useMemo(() => weekStart(calendarDate), [calendarDate]);
  const calendarDays = useMemo(() => Array.from({ length: 7 }, (_, index) => shiftDate(calendarWeekStart, index)), [calendarWeekStart]);
  const activeBookings = bookings.filter((booking) => booking.status === 'confirmed' && sessions.some((session) => session.id === booking.sessionId && !isPast(session)));
  const publishedCount = upcomingSessions.length;
  const openSpots = upcomingSessions.reduce((sum, session) => sum + availableSpots(session), 0);

  async function submitAdminLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adminAuthBusy) return;
    setAdminAuthBusy(true);
    setAdminAuthError('');
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminLogin),
      });
      if (!response.ok) {
        setAdminAuthError(response.status === 429 ? t.tooManyLoginAttempts : t.invalidCredentials);
        return;
      }
      setAdminAuthenticated(true);
      setAdminAuthChecked(true);
      setAdminLogin((current) => ({ ...current, password: '' }));
    } catch {
      setAdminAuthError(t.dataUnavailable);
    } finally {
      setAdminAuthBusy(false);
    }
  }

  async function logoutAdmin() {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      // The client state is cleared even if the network is unavailable.
    }
    window.location.assign('/');
  }

  async function updateReservationRequestStatus(id: string, status: ReservationRequestStatus) {
    if (adminBusyRef.current) return;
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    setAdminMessage('');
    try {
      const response = await fetch(`/api/admin/reservation-requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json() as { request?: ReservationRequest };
      if (response.status === 401) {
        setAdminAuthenticated(false);
      } else if (response.ok && data.request) {
        setReservationRequests((current) => current.map((item) => item.id === id ? data.request as ReservationRequest : item));
      } else {
        setAdminMessage(t.dataUnavailable);
      }
    } catch {
      setAdminMessage(t.dataUnavailable);
    } finally {
      adminBusyRef.current = false;
      setAdminBusy(false);
    }
  }

  function startEditVenue(venue: Venue) {
    setVenueEditorOpen(true);
    setVenueDraft({
      id: venue.id,
      name: venue.name,
      area: venue.area,
      address: venue.address ?? '',
      addressZh: venue.addressZh ?? '',
      postcode: venue.postcode ?? '',
      photo: venue.photo,
      photos: venue.photos?.length ? [...venue.photos] : [venue.photo],
      description: venue.description ?? '',
      descriptionZh: venue.descriptionZh ?? '',
      notes: venue.notes ?? '',
      peakPrice: String(venue.peakPricePence / 100),
      offPeakPrice: String(venue.offPeakPricePence / 100),
    });
    setAdminMessage('');
  }

  function chooseVenueImage(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (!files.length) return;
    if (files.some((file) => file.size > 1024 * 1024)) {
      setAdminMessage(t.imageTooLarge);
      event.currentTarget.value = '';
      return;
    }
    Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('invalid_image'));
      reader.onerror = () => reject(reader.error ?? new Error('image_read_failed'));
      reader.readAsDataURL(file);
    }))).then((images) => {
      setVenueDraft((current) => ({
        ...current,
        photo: current.photo || images[0] || '',
        photos: [...current.photos, ...images],
        notes: current.notes.replace(/\s*[（(]复用照片[）)]\s*/g, '').trim(),
      }));
      setAdminMessage('');
    }).catch(() => setAdminMessage(t.imageTooLarge));
  }

  function fallbackVenuePhoto(currentVenueId: string | null) {
    return venueList.find((venue) => venue.id !== currentVenueId && venue.photo.trim())?.photo
      || venues.find((venue) => venue.photo.trim())?.photo
      || '/venues/victoria-park.jpg';
  }

  function reuseVenuePhoto() {
    setVenueDraft((current) => ({
      ...current,
      photo: fallbackVenuePhoto(current.id),
      photos: [fallbackVenuePhoto(current.id)],
      notes: current.notes.includes('复用照片') ? current.notes : `${current.notes ? `${current.notes} ` : ''}${t.reusedPhotoNote}`,
    }));
    setAdminMessage('');
  }

  function applyVenueDefaultPrice(kind: 'peak' | 'offPeak') {
    const venue = getVenue(draft.venueId, venueList);
    const pricePence = kind === 'peak' ? venue.peakPricePence : venue.offPeakPricePence;
    setDraft((current) => ({ ...current, price: String(pricePence / 100) }));
  }

  async function saveVenue(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const peakPricePence = Math.round(Number(venueDraft.peakPrice) * 100);
    const offPeakPricePence = Math.round(Number(venueDraft.offPeakPrice) * 100);
    if (
      !venueDraft.name.trim() || !venueDraft.area.trim() || !venueDraft.photos.length || !venueDraft.photos[0].trim() ||
      !venueDraft.peakPrice.trim() || !venueDraft.offPeakPrice.trim() ||
      !Number.isInteger(peakPricePence) || peakPricePence < 0 ||
      !Number.isInteger(offPeakPricePence) || offPeakPricePence < 0 ||
      peakPricePence < offPeakPricePence
    ) {
      setAdminMessage(peakPricePence < offPeakPricePence ? t.priceRule : t.venueSaveFailed);
      return;
    }
    const existing = venueDraft.id ? venueList.find((venue) => venue.id === venueDraft.id) : undefined;
    const name = venueDraft.name.trim();
    const area = venueDraft.area.trim();
    const nextVenue: Venue = {
      id: venueDraft.id ?? `venue-${crypto.randomUUID()}`,
      name,
      nameZh: existing?.nameZh.trim() || name,
      area,
      areaZh: existing?.areaZh.trim() || area,
      address: venueDraft.address.trim(),
      addressZh: venueDraft.addressZh.trim(),
      postcode: venueDraft.postcode.trim().toUpperCase(),
      photo: venueDraft.photos[0].trim(),
      photos: venueDraft.photos.map((photo) => photo.trim()).filter(Boolean),
      description: venueDraft.description.trim() || null,
      descriptionZh: venueDraft.descriptionZh.trim() || null,
      notes: venueDraft.notes.trim(),
      peakPricePence,
      offPeakPricePence,
    };
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    let savedOnServer = false;
    try {
      const response = await fetch(
        existing ? `/api/admin/venues/${encodeURIComponent(existing.id)}` : '/api/admin/venues',
        {
          method: existing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nextVenue.name,
            nameZh: nextVenue.nameZh,
            area: nextVenue.area,
            areaZh: nextVenue.areaZh,
            address: nextVenue.address,
            addressZh: nextVenue.addressZh,
            postcode: nextVenue.postcode,
            photo: nextVenue.photo,
            photos: nextVenue.photos,
            description: nextVenue.description,
            descriptionZh: nextVenue.descriptionZh,
            notes: nextVenue.notes,
            peakPricePence,
            offPeakPricePence,
          }),
        },
      );
      const data = await response.json() as { venue?: unknown; error?: string };
      if (response.status === 401) {
        setAdminAuthenticated(false);
        setAdminMessage(t.invalidCredentials);
      } else if (response.ok) {
        const savedVenue = normalizeVenue(data.venue);
        if (savedVenue) {
          setVenueList((current) => existing
            ? current.map((venue) => (venue.id === existing.id ? savedVenue : venue))
            : [...current, savedVenue]);
          savedOnServer = true;
        }
      } else if (response.status >= 500) {
        setAdminMessage(t.adminSaveUnavailable);
      } else {
        setAdminMessage(t.venueSaveFailed);
      }
    } catch {
      setAdminMessage(t.adminSaveUnavailable);
    }
    if (savedOnServer) {
      setVenueDraft(emptyVenueDraft(venueList));
      setVenueEditorOpen(false);
      setAdminMessage(t.venueSaved);
    }
    adminBusyRef.current = false;
    setAdminBusy(false);
  }

  async function deleteSession(session: Session) {
    if (!window.confirm(t.deleteSessionConfirm)) return;
    if (bookings.some((booking) => booking.sessionId === session.id)) {
      setAdminMessage(t.sessionDeleteBlocked);
      return;
    }
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    let deletedOnServer = false;
    try {
      const response = await fetch(`/api/admin/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' });
      const data = response.status === 204 ? {} : await response.json() as { error?: string };
      if (response.ok) {
        deletedOnServer = true;
      } else if (response.status === 401) {
        setAdminAuthenticated(false);
        setAdminMessage(t.invalidCredentials);
      } else if (data.error === 'session_has_bookings') {
        setAdminMessage(t.sessionDeleteBlocked);
      } else if (response.status >= 500) {
        setAdminMessage(t.adminSaveUnavailable);
      } else {
        setAdminMessage(t.sessionDeleteFailed);
      }
    } catch {
      setAdminMessage(t.adminSaveUnavailable);
    }
    if (deletedOnServer) {
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setDraft((current) => current.id === session.id ? emptyDraft(venueList) : current);
      setAdminMessage(t.sessionDeleted);
    }
    adminBusyRef.current = false;
    setAdminBusy(false);
  }

  async function deleteVenue(venue: Venue) {
    if (!window.confirm(t.deleteVenueConfirm)) return;
    if (
      sessions.some((session) => session.venueId === venue.id) ||
      reservationRequests.some((request) => request.venueId === venue.id)
    ) {
      setAdminMessage(t.venueDeleteBlocked);
      return;
    }
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    let deletedOnServer = false;
    try {
      const response = await fetch(`/api/admin/venues/${encodeURIComponent(venue.id)}`, { method: 'DELETE' });
      const data = response.status === 204 ? {} : await response.json() as { error?: string };
      if (response.ok) {
        deletedOnServer = true;
      } else if (response.status === 401) {
        setAdminAuthenticated(false);
        setAdminMessage(t.invalidCredentials);
      } else if (data.error === 'venue_in_use') {
        setAdminMessage(t.venueDeleteBlocked);
      } else if (response.status >= 500) {
        setAdminMessage(t.adminSaveUnavailable);
      } else {
        setAdminMessage(t.venueDeleteFailed);
      }
    } catch {
      setAdminMessage(t.adminSaveUnavailable);
    }
    if (deletedOnServer) {
      const remainingVenues = venueList.filter((item) => item.id !== venue.id);
      setVenueList(remainingVenues);
      setVenueDraft((current) => current.id === venue.id ? emptyVenueDraft(remainingVenues) : current);
      setAdminMessage(t.venueDeleted);
    }
    adminBusyRef.current = false;
    setAdminBusy(false);
  }

  function startEdit(session: Session) {
    setSessionEditorOpen(true);
    setDraft({
      id: session.id,
      venueId: session.venueId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      price: String(session.pricePence / 100),
      capacity: String(session.capacity),
      formats: normalizeFormats(session.formats),
      seekingLevels: session.seekingLevels ?? [],
      status: session.status,
    });
    setAdminMessage('');
  }

  function sessionOverlaps(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) {
    return parseMinutes(a.startTime) < parseMinutes(b.endTime) && parseMinutes(b.startTime) < parseMinutes(a.endTime);
  }

  async function setSessionFull(session: Session, markedFull: boolean) {
    if (markedFull && !window.confirm(t.markFullConfirm)) return;
    try {
      const response = await fetch(`/api/admin/sessions/${session.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayload({ ...session, markedFull })),
      });
      const data = await response.json();
      if (!response.ok) { setAdminMessage(data.error === 'capacity_too_low' ? t.cannotReduceCapacity : t.saveFailed); return; }
      setSessions((current) => current.map((item) => item.id === session.id ? data.session : item));
      setAdminMessage(t.sessionSaved);
    } catch { setAdminMessage(t.saveFailed); }
  }

  async function saveDraft(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const pricePence = Math.round(Number(draft.price) * 100);
    const capacity = Number(draft.capacity);
    const formats = validFormats(draft.formats);
    if (!formats.length) {
      setAdminMessage(t.chooseAtLeastOneFormat);
      return;
    }
    if (
      !draft.date ||
      !draft.startTime ||
      !draft.endTime ||
      !Number.isFinite(pricePence) ||
      pricePence < 0 ||
      !Number.isInteger(capacity) ||
      capacity < 0
    ) {
      setAdminMessage(t.saveFailed);
      return;
    }
    if (parseMinutes(draft.endTime) <= parseMinutes(draft.startTime)) {
      setAdminMessage(t.endBeforeStart);
      return;
    }
    const existing = draft.id ? sessions.find((session) => session.id === draft.id) : undefined;
    const scheduleChanged = !existing || existing.venueId !== draft.venueId || existing.date !== draft.date || existing.startTime !== draft.startTime || existing.endTime !== draft.endTime;
    const conflictingSession = scheduleChanged
      ? sessions.find((session) => session.id !== existing?.id && session.venueId === draft.venueId && session.date === draft.date && sessionOverlaps(draft, session))
      : undefined;
    if (conflictingSession) {
      setAdminMessage(t.conflictDetected);
      return;
    }
    if (existing && capacity < existing.bookedSpots) {
      setAdminMessage(t.cannotReduceCapacity);
      return;
    }
    const nextSession: Session = {
      id: draft.id ?? `session-${crypto.randomUUID()}`,
      venueId: draft.venueId,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      pricePence,
      capacity,
      bookedSpots: existing?.bookedSpots ?? 0,
      formats,
      seekingLevels: draft.seekingLevels,
      status: draft.status,
    };
    const payload = sessionPayload(nextSession);
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    let savedOnServer = false;
    try {
      const response = await fetch(
        existing ? `/api/admin/sessions/${encodeURIComponent(existing.id)}` : '/api/admin/sessions',
        {
          method: existing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json() as { session?: Session; error?: string };
      if (response.ok && data.session) {
        setSessions((current) => existing
          ? current.map((session) => (session.id === existing.id ? data.session as Session : session))
          : [...current, data.session as Session]);
        savedOnServer = true;
      } else if (response.status === 401) {
        setAdminAuthenticated(false);
        setAdminMessage(t.invalidCredentials);
      } else if (data.error === 'locked_fields') {
        setAdminMessage(t.lockedFields);
      } else if (data.error === 'capacity_too_low') {
        setAdminMessage(t.cannotReduceCapacity);
      } else if (response.status === 503) {
        setAdminMessage(t.adminSaveUnavailable);
      } else {
        setAdminMessage(t.saveFailed);
      }
    } catch {
      setAdminMessage(t.adminSaveUnavailable);
    }
    if (savedOnServer) {
      setAdminMessage(t.sessionSaved);
      setSessionDateFilter('');
      setSessionVenueFilter('');
      setSessionStatusFilter('');
      setCalendarDate(nextSession.date);
      if (isPast(nextSession)) setShowExpiredSessions(true);
      setDraft(emptyDraft(venueList));
      setSessionEditorOpen(false);
    }
    adminBusyRef.current = false;
    setAdminBusy(false);
  }

  async function bulkUpdateSessionStatus(status: SessionStatus) {
    const targets = sessions.filter((session) => selectedSessionIds.includes(session.id));
    if (!targets.length) return;
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    const results = await Promise.all(targets.map(async (session) => {
      try {
        const response = await fetch(`/api/admin/sessions/${encodeURIComponent(session.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            venueId: session.venueId,
            date: session.date,
            startTime: session.startTime,
            endTime: session.endTime,
            pricePence: session.pricePence,
            capacity: session.capacity,
            formats: session.formats,
            seekingLevels: session.seekingLevels ?? [],
            status,
          }),
        });
        const data = await response.json() as { session?: Session };
        return response.ok && data.session ? data.session : null;
      } catch {
        return null;
      }
    }));
    const updated = results.filter((session): session is Session => Boolean(session));
    if (updated.length) {
      const updatedById = new Map(updated.map((session) => [session.id, session]));
      setSessions((current) => current.map((session) => updatedById.get(session.id) ?? session));
    }
    setSelectedSessionIds([]);
    setAdminMessage(updated.length === targets.length
      ? t.bulkUpdateSuccess.replace('{count}', String(updated.length))
      : t.bulkUpdateFailed);
    adminBusyRef.current = false;
    setAdminBusy(false);
  }

  async function createRecurringSessions(session: Session) {
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    const created: Session[] = [];
    for (let week = 1; week <= 4; week += 1) {
      const candidate = { ...session, id: '', date: shiftDate(session.date, week * 7), bookedSpots: 0, markedFull: false };
      const conflict = sessions.some((item) => item.venueId === candidate.venueId && item.date === candidate.date && sessionOverlaps(item, candidate))
        || created.some((item) => item.venueId === candidate.venueId && item.date === candidate.date && sessionOverlaps(item, candidate));
      if (conflict) continue;
      try {
        const response = await fetch('/api/admin/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionPayload(candidate)),
        });
        const data = await response.json() as { session?: Session };
        if (response.ok && data.session) created.push(data.session);
      } catch {
        break;
      }
    }
    if (created.length) {
      setSessions((current) => [...current, ...created]);
      setAdminMessage(t.repeatCreated.replace('{count}', String(created.length)));
    } else {
      setAdminMessage(t.bulkUpdateFailed);
    }
    adminBusyRef.current = false;
    setAdminBusy(false);
  }

  function exportSessions() {
    const header = ['id', 'date', 'startTime', 'endTime', 'venue', 'status', 'price', 'capacity', 'bookedSpots', 'seekingLevels'];
    const rows = adminSessions.map((session) => [
      session.id,
      session.date,
      session.startTime,
      session.endTime,
      getVenue(session.venueId, venueList).name,
      session.status,
      (session.pricePence / 100).toFixed(2),
      String(session.capacity),
      String(session.bookedSpots),
      (session.seekingLevels ?? []).join(', '),
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tennis-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importSessions(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setSessionImportMessage('');
    setSessionImportFailed(false);
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    try {
      const sessionsToImport = await parseSessionWorkbook(file);
      const response = await fetch('/api/admin/sessions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: sessionsToImport }),
      });
      const data = await response.json() as {
        error?: string;
        rows?: number[];
        unknownVenues?: string[];
        issues?: Array<{ row?: unknown; fields?: unknown }>;
        sessions?: Session[];
        importedCount?: number;
        createdVenues?: unknown[];
        createdVenueCount?: number;
      };

      if (response.status === 401) {
        setAdminAuthenticated(false);
        setSessionImportMessage(t.sessionImportFailed);
        setSessionImportFailed(true);
        return;
      }
      if (!response.ok) {
        const rowList = Array.isArray(data.rows) ? data.rows.join(', ') : '';
        if (data.error === 'invalid_import_rows') {
          const issueDetails = Array.isArray(data.issues)
            ? data.issues.map((issue) => {
              const row = typeof issue.row === 'number' ? issue.row : '?';
              const fields = Array.isArray(issue.fields)
                ? issue.fields.filter((field): field is SessionImportIssueCode => typeof field === 'string').map((field) => importIssueLabel(field, language)).join(language === 'zh' ? '、' : ', ')
                : '';
              return `${row}（${fields || t.importIssueRow}）`;
            }).join(language === 'zh' ? '；' : '; ')
            : '';
          const unknownVenues = Array.isArray(data.unknownVenues)
            ? data.unknownVenues.filter((venue): venue is string => typeof venue === 'string' && Boolean(venue.trim())).join(', ')
            : '';
          setSessionImportMessage(issueDetails
            ? t.sessionImportInvalidDetails.replace('{details}', issueDetails)
            : unknownVenues
            ? t.sessionImportUnknownVenues.replace('{rows}', rowList).replace('{venues}', unknownVenues)
            : t.sessionImportInvalidRows.replace('{rows}', rowList));
        } else if (data.error === 'duplicate_import_rows') {
          const issueDetails = Array.isArray(data.issues)
            ? data.issues.map((issue) => {
              const row = typeof issue.row === 'number' ? issue.row : '?';
              return `${row}（${t.importIssueDuplicate}）`;
            }).join(language === 'zh' ? '；' : '; ')
            : '';
          setSessionImportMessage(issueDetails || t.sessionImportDuplicateRows.replace('{rows}', rowList));
        } else if (data.error === 'import_too_many_rows') {
          setSessionImportMessage(t.sessionImportTooManyRows);
        } else if (data.error === 'import_too_large') {
          setSessionImportMessage(t.sessionImportTooLarge);
        } else {
          setSessionImportMessage(t.sessionImportFailed);
        }
        setSessionImportFailed(true);
        return;
      }

      if (!data.sessions?.length) {
        setSessionImportMessage(t.sessionImportFailed);
        setSessionImportFailed(true);
        return;
      }
      setSessions((current) => [...current, ...data.sessions as Session[]]);
      const createdVenues = (data.createdVenues ?? []).map(normalizeVenue).filter((venue): venue is Venue => Boolean(venue));
      if (createdVenues.length) {
        setVenueList((current) => {
          const createdIds = new Set(createdVenues.map((venue) => venue.id));
          return [...current.filter((venue) => !createdIds.has(venue.id)), ...createdVenues];
        });
        setSessionImportMessage(t.sessionImportCreatedVenues
          .replace('{count}', String(data.importedCount ?? data.sessions.length))
          .replace('{venues}', String(data.createdVenueCount ?? createdVenues.length)));
      } else {
        setSessionImportMessage(t.sessionImportSuccess.replace('{count}', String(data.importedCount ?? data.sessions.length)));
      }
    } catch (error) {
      if (error instanceof SessionImportError) {
        const messages = {
          invalid_file: t.sessionImportInvalidFile,
          missing_columns: t.sessionImportMissingColumns,
          empty_workbook: t.sessionImportFailed,
          empty_sessions: t.sessionImportNoRows,
          too_many_rows: t.sessionImportTooManyRows,
        };
        setSessionImportMessage(messages[error.code]);
        setSessionImportFailed(true);
      } else {
        setSessionImportMessage(t.sessionImportFailed);
        setSessionImportFailed(true);
      }
    } finally {
      adminBusyRef.current = false;
      setAdminBusy(false);
    }
  }

  /** Mirrors a booking cancelled or refunded in the admin bookings tab into local state. */
  function applyBookingChange(bookingId: string, status: BookingStatus) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking || booking.status !== 'confirmed') {
      setBookings((current) => current.map((item) => (item.id === bookingId ? { ...item, status } : item)));
      return;
    }
    setBookings((current) => current.map((item) => (item.id === bookingId ? { ...item, status } : item)));
    setSessions((current) => current.map((session) => {
      if (session.id !== booking.sessionId) return session;
      const remainingParticipants = [...booking.participants];
      return {
        ...session,
        bookedSpots: Math.max(0, session.bookedSpots - booking.participants.length),
        bookingPreferences: session.bookingPreferences
          ? session.bookingPreferences.filter((preference) => {
            const participantIndex = remainingParticipants.findIndex(
              (level) => level === preference.level && booking.format === preference.format,
            );
            if (participantIndex < 0) return true;
            remainingParticipants.splice(participantIndex, 1);
            return false;
          })
          : session.bookingPreferences,
      };
    }));
  }

  async function updateRacketRentalSetting(enabled: boolean) {
    if (racketRentalBusy || enabled === racketRentalEnabled) return;
    setRacketRentalBusy(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ racketRentalEnabled: enabled }),
      });
      const data = await response.json() as { racketRentalEnabled?: unknown; error?: string };
      if (response.status === 401) {
        setAdminAuthenticated(false);
        setAdminMessage(t.invalidCredentials);
      } else if (response.ok && typeof data.racketRentalEnabled === 'boolean') {
        setRacketRentalEnabled(data.racketRentalEnabled);
        setAdminMessage(t.sessionSaved);
      } else {
        setAdminMessage(t.dataUnavailable);
      }
    } catch {
      setAdminMessage(t.dataUnavailable);
    } finally {
      setRacketRentalBusy(false);
    }
  }

  return (
    <div className="app-shell admin-shell">
      <header className="site-header admin-header">
        <div className="site-header-inner">
          {/* oxlint-disable-next-line next/no-html-link-for-pages -- the public site is a separate app; a full page load is intended */}
          <a className="brand-lockup" href="/">
            <AppMark />
            <span>
              <strong>Tennis Match</strong>
              <small>{language === 'zh' ? '管理后台' : 'Admin'}</small>
            </span>
          </a>
          <nav className="admin-header-actions">
            <button type="button" className="language-switch" onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>
              <Globe size={16} aria-hidden="true" /> {language === 'zh' ? 'English' : '中文'}
            </button>
            {/* oxlint-disable-next-line next/no-html-link-for-pages -- see above */}
            <a href="/" className="admin-back-link">
              <ArrowLeft size={15} aria-hidden="true" /> {language === 'zh' ? '返回网站' : 'Back to site'}
            </a>
          </nav>
        </div>
      </header>
      <main>
        <AdminView
          adminAuthChecked={adminAuthChecked}
          adminAuthenticated={adminAuthenticated}
          adminAuthBusy={adminAuthBusy}
          adminAuthError={adminAuthError}
          adminLogin={adminLogin}
          setAdminLogin={setAdminLogin}
          onSubmitAdminLogin={submitAdminLogin}
          adminTab={adminTab}
          setAdminTab={setAdminTab}
          adminSessions={adminSessions}
          allSessions={allSessions}
          venueList={venueList}
          bookings={bookings}
          activeBookings={activeBookings}
          reservationRequests={reservationRequests}
          publishedCount={publishedCount}
          openSpots={openSpots}
          racketRentalEnabled={racketRentalEnabled}
          racketRentalBusy={racketRentalBusy}
          onUpdateRacketRental={(enabled) => void updateRacketRentalSetting(enabled)}
          adminBusy={adminBusy}
          adminMessage={adminMessage}
          sessionEditorOpen={sessionEditorOpen}
          setSessionEditorOpen={setSessionEditorOpen}
          venueEditorOpen={venueEditorOpen}
          setVenueEditorOpen={setVenueEditorOpen}
          draft={draft}
          setDraft={setDraft}
          venueDraft={venueDraft}
          setVenueDraft={setVenueDraft}
          showExpiredSessions={showExpiredSessions}
          setShowExpiredSessions={setShowExpiredSessions}
          sessionView={sessionView}
          setSessionView={setSessionView}
          calendarDate={calendarDate}
          setCalendarDate={setCalendarDate}
          calendarDays={calendarDays}
          sessionDateFilter={sessionDateFilter}
          setSessionDateFilter={setSessionDateFilter}
          sessionVenueFilter={sessionVenueFilter}
          setSessionVenueFilter={setSessionVenueFilter}
          sessionStatusFilter={sessionStatusFilter}
          setSessionStatusFilter={setSessionStatusFilter}
          selectedSessionIds={selectedSessionIds}
          setSelectedSessionIds={setSelectedSessionIds}
          sessionImportInput={sessionImportInput}
          sessionImportMessage={sessionImportMessage}
          sessionImportFailed={sessionImportFailed}
          language={language}
          t={t}
          onLogoutAdmin={() => void logoutAdmin()}
          onSaveDraft={saveDraft}
          onSaveVenue={saveVenue}
          onChooseVenueImage={chooseVenueImage}
          onReuseVenuePhoto={reuseVenuePhoto}
          onApplyVenueDefaultPrice={applyVenueDefaultPrice}
          onStartEditSession={startEdit}
          onCreateRecurringSessions={(session) => void createRecurringSessions(session)}
          onSetSessionFull={(session, markedFull) => void setSessionFull(session, markedFull)}
          onDeleteSession={(session) => void deleteSession(session)}
          onBulkUpdateSessionStatus={(status) => void bulkUpdateSessionStatus(status)}
          onExportSessions={exportSessions}
          onDataChanged={() => setDataVersion((value) => value + 1)}
          onImportSessions={(event) => void importSessions(event)}
          onBookingChanged={applyBookingChange}
          onUpdateReservationRequestStatus={(id, status) => void updateReservationRequestStatus(id, status)}
          onReservationRequestCreated={(request) => setReservationRequests((current) => [request, ...current])}
          onStartEditVenue={startEditVenue}
          onDeleteVenue={(venue) => void deleteVenue(venue)}
        />
      </main>
    </div>
  );
}
