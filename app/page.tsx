'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";

import { AppMark } from "@/components/app-mark";
import { SiteHeader } from "@/components/site-header";
import { AccountView } from "@/components/views/account-view";
import { AdminView } from "@/components/views/admin-view";
import { BookingView } from "@/components/views/booking-view";
import { ConfirmationView } from "@/components/views/confirmation-view";
import { DetailView } from "@/components/views/detail-view";
import { HomeView } from "@/components/views/home-view";
import { RequestView } from "@/components/views/request-view";
import { BookingChat } from "@/components/booking-chat";
import {
  createDemoBookings,
  createDemoSessions,
  GAME_FORMATS,
  RACKET_PRICE_PENCE,
  venues,
  type GameFormat,
  type PreferredFormat,
  type Venue,
} from "@/lib/demo-data";
import { formatLongDate, importIssueLabel, parseMinutes } from "@/lib/formatters";
import { parseSessionWorkbook, SessionImportError } from "@/lib/session-import";
import {
  ADMIN_SESSION_STORAGE_KEY,
  SESSION_RECOVERY_STORAGE_KEY,
  BOOKING_STORAGE_KEY,
  dateFromToday,
  emptyDraft,
  emptyVenueDraft,
  getVenue,
  isPast,
  LANGUAGE_STORAGE_KEY,
  normalizeBooking,
  normalizeFormats,
  normalizeLocation,
  normalizeSession,
  normalizeVenue,
  profileFormFromUser,
  routeStateFromLocation,
  SESSION_STORAGE_KEY,
  sessionSort,
  shiftDate,
  validFormats,
  VENUE_STORAGE_KEY,
  venueLabel,
  venueSearchText,
  weekStart,
} from "@/lib/tennis-utils";
import { translations } from "@/lib/translations";
import type {
  AdminTab,
  AuthMode,
  Booking,
  BookingStage,
  ConfirmationEmailStatus,
  Language,
  LoyaltyStatus,
  ModelContext,
  PreferredTime,
  ProfileForm,
  ReservationRequest,
  ReservationRequestForm,
  ReservationRequestStatus,
  Session,
  SessionDraft,
  SessionImportIssueCode,
  SessionStatus,
  UserProfile,
  VenueDraft,
  View,
} from "@/types/tennis";

const seededSessions: Session[] = createDemoSessions();
const seededBookings: Booking[] = createDemoBookings(seededSessions);

export function TennisSocialApp({ initialView = "home" }: { initialView?: View }) {
  const [language, setLanguageValue] = useState<Language>('en');
  const [venueList, setVenueList] = useState<Venue[]>(venues);
  const [sessions, setSessions] = useState<Session[]>(seededSessions);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>(seededBookings);
  const [reservationRequests, setReservationRequests] = useState<ReservationRequest[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [initialRoute] = useState<{ view: View; sessionId: string | null; bookingStage: BookingStage }>(() => initialView === 'admin' ? { view: 'admin', sessionId: null, bookingStage: 'details' } : routeStateFromLocation());
  const [view, setView] = useState<View>(initialRoute.view);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialRoute.sessionId);
  const [bookingStage, setBookingStage] = useState<BookingStage>(initialRoute.bookingStage);
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    participants: [''],
    format: '' as GameFormat | '',
    racketCount: 0,
    includeFriends: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [adjustmentNotice, setAdjustmentNotice] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [confirmation, setConfirmation] = useState<Booking | null>(null);
  const [confirmationEmailStatus, setConfirmationEmailStatus] = useState<ConfirmationEmailStatus>('not_applicable');
  const [adminTab, setAdminTab] = useState<AdminTab>('sessions');
  const [showExpiredSessions, setShowExpiredSessions] = useState(false);
  const [sessionEditorOpen, setSessionEditorOpen] = useState(false);
  const [venueEditorOpen, setVenueEditorOpen] = useState(false);
  const [sessionDateFilter, setSessionDateFilter] = useState('');
  const [sessionVenueFilter, setSessionVenueFilter] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<SessionStatus | ''>('');
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [sessionView, setSessionView] = useState<'list' | 'week'>('list');
  const [calendarDate, setCalendarDate] = useState(() => dateFromToday(0));
  const [undoSessions, setUndoSessions] = useState<Session[] | null>(null);
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyStatus | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [userAuthChecked, setUserAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: '',
    email: '',
    phone: '',
    postcode: '',
    tennisLevel: '',
    preferredTime: 'weekends',
    preferredFormat: 'singles',
  });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    postcode: '',
    tennisLevel: '',
    preferredTime: 'weekends' as PreferredTime,
    preferredFormat: 'singles' as PreferredFormat,
  });
  const [requestForm, setRequestForm] = useState<ReservationRequestForm>({
    requestType: 'known_venue',
    venueId: null,
    venueName: '',
    postcode: '',
    preferredDate: dateFromToday(7),
    startTime: '18:00',
    endTime: '20:00',
    contactName: '',
    email: '',
    phone: '',
    message: '',
  });
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestVenueOpen, setRequestVenueOpen] = useState(false);
  const [requestVenueActiveIndex, setRequestVenueActiveIndex] = useState(-1);
  const [submittedRequest, setSubmittedRequest] = useState<ReservationRequest | null>(null);
  const sessionsRef = useRef(sessions);
  const sessionLoadVersion = useRef(0);
  const adminBusyRef = useRef(false);
  const openSessionRef = useRef<(sessionId: string) => void>(() => undefined);
  const paymentSubmittingRef = useRef(false);
  const cancellingBookingRef = useRef(new Set<string>());

  const t = translations[language];
  const requestVenueSuggestions = useMemo(() => {
    const query = normalizeLocation(requestForm.venueName);
    const matches = query
      ? venueList.filter((venue) => venueSearchText(venue).includes(query))
      : venueList;
    return matches.slice(0, 8);
  }, [requestForm.venueName, venueList]);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedVenue = selectedSession ? getVenue(selectedSession.venueId, venueList) : null;
  const activeBookings = bookings.filter((booking) => booking.status === 'confirmed');
  const availableCoupons = loyalty?.legacyCouponsEnabled
    ? loyalty.coupons.filter((coupon) => coupon.status === 'available')
    : [];
  const selectedCoupon = availableCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null;
  const permanentDiscountPercent = user && loyalty?.permanentDiscountEligible
    ? loyalty.permanentDiscountPercent
    : 0;

  async function loadLoyaltyStatus() {
    setLoyaltyLoading(true);
    try {
      const response = await fetch('/api/loyalty', { cache: 'no-store' });
      const data = await response.json() as { loyalty?: LoyaltyStatus };
      if (response.ok && data.loyalty) {
        setLoyalty(data.loyalty);
        const defaultCoupon = data.loyalty.legacyCouponsEnabled
          ? data.loyalty.coupons.find((coupon) => coupon.status === 'available' && new Date(coupon.expiresAt).getTime() > Date.now())
          : undefined;
        setSelectedCouponId((current) => current || defaultCoupon?.id || '');
      } else {
        setLoyalty(null);
      }
    } catch {
      setLoyalty(null);
    } finally {
      setLoyaltyLoading(false);
    }
  }

  useEffect(() => {
    try {
      const legacySessions = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (legacySessions && !window.localStorage.getItem(SESSION_RECOVERY_STORAGE_KEY)) {
        window.localStorage.setItem(SESSION_RECOVERY_STORAGE_KEY, legacySessions);
      }
      const savedSessions = initialRoute.view === 'admin'
        ? window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || legacySessions
        : legacySessions;
      const savedBookings = window.localStorage.getItem(BOOKING_STORAGE_KEY);
      const savedVenues = window.localStorage.getItem(VENUE_STORAGE_KEY);
      const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions) as Session[];
        setSessions(parsedSessions.map(normalizeSession));
      }
      if (savedBookings) {
        const parsedBookings = JSON.parse(savedBookings) as Booking[];
        setBookings(parsedBookings.map(normalizeBooking));
      }
      if (savedVenues) {
        const parsedVenues = JSON.parse(savedVenues) as unknown[];
        const normalizedVenues = parsedVenues.map(normalizeVenue).filter((venue): venue is Venue => Boolean(venue));
        if (normalizedVenues.length) setVenueList(normalizedVenues);
      }
      if (savedLanguage === 'en' || savedLanguage === 'zh') setLanguageValue(savedLanguage);
    } catch {
      // If local storage is unavailable, the seeded demo remains usable.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const loadUserSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const data = await response.json() as { user?: UserProfile };
        if (!cancelled && response.ok && data.user) {
          setUser(data.user);
          setProfileForm(profileFormFromUser(data.user));
          void loadLoyaltyStatus();
        }
      } catch {
        // Booking remains available to guests when account services are offline.
      } finally {
        if (!cancelled) setUserAuthChecked(true);
      }
    };

    const loadPublicSettings = async () => {
      try {
        const response = await fetch('/api/config', { cache: 'no-store' });
        const data = await response.json() as { racketRentalEnabled?: unknown };
        if (!cancelled && typeof data.racketRentalEnabled === 'boolean') {
          setRacketRentalEnabled(data.racketRentalEnabled);
          if (!data.racketRentalEnabled) setBookingForm((current) => ({ ...current, racketCount: 0 }));
        }
      } catch {
        // The safe default keeps rental disabled until the persisted setting is known.
      }
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') void loadPublicSettings();
    };

    const loadVenues = async () => {
      try {
        const response = await fetch('/api/venues', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { venues?: unknown[]; source?: string };
        const nextVenues = data.venues?.map(normalizeVenue).filter((venue): venue is Venue => Boolean(venue)) ?? [];
        if (!cancelled && data.source === 'database' && nextVenues.length) setVenueList(nextVenues);
      } catch {
        // The seeded browser data remains visible if the server is unavailable.
      }
    };

    const reconcileCheckout = async () => {
      const query = new URLSearchParams(window.location.search);
      const checkoutState = query.get('checkout');
      if (checkoutState === 'cancelled') {
        const draftValue = window.sessionStorage.getItem('tennis-social-checkout-draft-v1');
        if (draftValue) {
          try {
            const saved = JSON.parse(draftValue) as {
              sessionId?: unknown;
              bookingForm?: typeof bookingForm;
            };
            if (typeof saved.sessionId === 'string' && saved.bookingForm?.participants?.length) {
              const restoredSession = sessionsRef.current.find((session) => session.id === saved.sessionId);
              const availableFormats = restoredSession?.formats ?? [...GAME_FORMATS];
              const savedFormat = saved.bookingForm.format;
              const restoredFormat = GAME_FORMATS.includes(savedFormat as GameFormat) && availableFormats.includes(savedFormat as GameFormat)
                ? savedFormat as GameFormat
                : availableFormats[0];
              setSelectedSessionId(saved.sessionId);
              setBookingForm({ ...saved.bookingForm, format: restoredFormat });
              setBookingStage('payment');
              setPaymentCancelled(true);
              setView('booking');
              window.sessionStorage.removeItem('tennis-social-checkout-draft-v1');
              window.history.replaceState({}, '', `/?view=booking&session=${encodeURIComponent(saved.sessionId)}&stage=payment`);
              window.scrollTo({ top: 0 });
            }
          } catch {
            window.sessionStorage.removeItem('tennis-social-checkout-draft-v1');
          }
        }
        return;
      }
      if (checkoutState !== 'success') return;
      const bookingId = query.get('booking_id');
      const checkoutSessionId = query.get('checkout_session_id');
      if (!bookingId || !checkoutSessionId) {
        if (!cancelled) setView('home');
        return;
      }
      try {
        const response = await fetch(
          `/api/bookings/${encodeURIComponent(bookingId)}?checkout_session_id=${encodeURIComponent(checkoutSessionId)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) throw new Error('booking_unavailable');
        const data = await response.json() as { booking?: Booking; confirmationEmailStatus?: ConfirmationEmailStatus };
        if (!cancelled && data.booking?.status === 'confirmed') {
          setSelectedSessionId(data.booking.sessionId);
          setConfirmation(normalizeBooking(data.booking));
          setConfirmationEmailStatus(data.confirmationEmailStatus ?? 'in_progress');
          void loadLoyaltyStatus();
          setView('confirmation');
          window.sessionStorage.removeItem('tennis-social-checkout-draft-v1');
          window.history.replaceState({}, '', `/?view=confirmation&session=${encodeURIComponent(data.booking.sessionId)}&booking=${encodeURIComponent(data.booking.id)}`);
          window.scrollTo({ top: 0 });
        }
      } catch {
        if (!cancelled) {
          setPaymentFailed(true);
          setView('home');
        }
      }
    };

    void loadPublicSettings();
    void loadVenues();
    void loadUserSession();
    void reconcileCheckout();
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || view !== 'admin') return;
    let cancelled = false;
    const checkAdminSession = async () => {
      try {
        const response = await fetch('/api/admin/auth/session', { cache: 'no-store' });
        if (!cancelled) setAdminAuthenticated(response.ok);
      } catch {
        if (!cancelled) setAdminAuthenticated(false);
      } finally {
        if (!cancelled) setAdminAuthChecked(true);
      }
    };
    void checkAdminSession();
    return () => { cancelled = true; };
  }, [hydrated, view]);

  useEffect(() => {
    if (!hydrated || view !== 'admin' || !adminAuthChecked || !adminAuthenticated) return;
    let cancelled = false;
    const loadAdminSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        if (response.status === 401) {
          if (!cancelled) setAdminAuthenticated(false);
          return;
        }
        const data = await response.json() as { racketRentalEnabled?: unknown };
        if (!cancelled && response.ok && typeof data.racketRentalEnabled === 'boolean') {
          setRacketRentalEnabled(data.racketRentalEnabled);
          if (!data.racketRentalEnabled) setBookingForm((current) => ({ ...current, racketCount: 0 }));
        } else if (!cancelled && !response.ok) {
          setAdminMessage(t.dataUnavailable);
        }
      } catch {
        if (!cancelled) setAdminMessage(t.dataUnavailable);
      }
    };
    const loadAdminBookings = async () => {
      try {
        const response = await fetch('/api/admin/bookings', { cache: 'no-store' });
        if (response.status === 401) {
          if (!cancelled) setAdminAuthenticated(false);
          return;
        }
        if (!response.ok) return;
        const data = await response.json() as { bookings?: Booking[] };
        if (!cancelled && data.bookings) setBookings(data.bookings.map(normalizeBooking));
      } catch {
        // The browser cache remains available for local previews without a database.
      }
    };
    const loadAdminVenues = async () => {
      try {
        const response = await fetch('/api/admin/venues', { cache: 'no-store' });
        if (response.status === 401) {
          if (!cancelled) setAdminAuthenticated(false);
          return;
        }
        if (!response.ok) return;
        const data = await response.json() as { venues?: unknown[] };
        const nextVenues = data.venues?.map(normalizeVenue).filter((venue): venue is Venue => Boolean(venue)) ?? [];
        if (!cancelled && nextVenues.length) setVenueList(nextVenues);
      } catch {
        // The browser cache remains available for local previews without a database.
      }
    };
    const loadReservationRequests = async () => {
      try {
        const response = await fetch('/api/admin/reservation-requests', { cache: 'no-store' });
        if (response.status === 401) {
          if (!cancelled) setAdminAuthenticated(false);
          return;
        }
        if (!response.ok) return;
        const data = await response.json() as { requests?: ReservationRequest[] };
        if (!cancelled && data.requests) setReservationRequests(data.requests);
      } catch {
        // The rest of the admin dashboard remains usable if requests are unavailable.
      }
    };
    void loadAdminSettings();
    void loadAdminBookings();
    void loadAdminVenues();
    void loadReservationRequests();
    return () => { cancelled = true; };
  }, [adminAuthChecked, adminAuthenticated, hydrated, view]);

  // One session loader owns the list: public requests must never overwrite the
  // authenticated admin list, and responses started before a save are stale.
  const isAdminView = view === 'admin';
  useEffect(() => {
    if (!hydrated || (isAdminView && (!adminAuthChecked || !adminAuthenticated))) return;
    let cancelled = false;
    const load = async () => {
      if (adminBusyRef.current) return;
      const version = ++sessionLoadVersion.current;
      try {
        const response = await fetch(isAdminView ? '/api/admin/sessions' : '/api/sessions', { cache: 'no-store' });
        if (cancelled || version !== sessionLoadVersion.current) return;
        if (isAdminView && response.status === 401) {
          setAdminAuthenticated(false);
          return;
        }
        if (!response.ok) throw new Error('sessions_unavailable');
        const data = await response.json() as { sessions?: Session[] };
        if (!Array.isArray(data.sessions)) throw new Error('invalid_sessions');
        if (!cancelled && version === sessionLoadVersion.current) {
          setSessions(data.sessions.map(normalizeSession));
        }
      } catch {
        if (!cancelled && version === sessionLoadVersion.current && isAdminView) {
          setAdminMessage(translations[language].adminSessionsUnavailable);
        }
      } finally {
        if (!cancelled && version === sessionLoadVersion.current) setSessionsReady(true);
      }
    };
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const sync = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY || event.key === ADMIN_SESSION_STORAGE_KEY) void load();
    };
    void load();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', sync);
    return () => {
      cancelled = true;
      ++sessionLoadVersion.current;
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', sync);
    };
  }, [adminAuthChecked, adminAuthenticated, hydrated, isAdminView]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(isAdminView ? ADMIN_SESSION_STORAGE_KEY : SESSION_STORAGE_KEY, JSON.stringify(sessions));
      window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(bookings));
      window.localStorage.setItem(VENUE_STORAGE_KEY, JSON.stringify(venueList));
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Browser storage is only a cache; database saves do not depend on it.
    }
  }, [bookings, hydrated, isAdminView, language, sessions, venueList]);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.status === 'published' && !isPast(session))
        .sort(sessionSort),
    [sessions],
  );

  const allSessions = useMemo(() => [...sessions].sort(sessionSort), [sessions]);
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
  const couponDiscountPercent = selectedCoupon?.discountPercent ?? 0;
  const appliedDiscountPercent = Math.max(permanentDiscountPercent, couponDiscountPercent);
  const loyaltyDiscountPence = selectedSession && permanentDiscountPercent > couponDiscountPercent
    ? (selectedSession.pricePence - Math.floor(selectedSession.pricePence * (100 - permanentDiscountPercent) / 100)) * bookingForm.participants.length
    : 0;
  const couponDiscountPence = selectedSession && selectedCoupon && couponDiscountPercent >= permanentDiscountPercent
    ? (selectedSession.pricePence - Math.floor(selectedSession.pricePence * (100 - couponDiscountPercent) / 100)) * bookingForm.participants.length
    : 0;
  const totalPence = selectedSession
    ? Math.floor(selectedSession.pricePence * (100 - appliedDiscountPercent) / 100) * bookingForm.participants.length +
      (racketRentalEnabled ? bookingForm.racketCount : 0) * RACKET_PRICE_PENCE
    : 0;

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollToSessions() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('sessions')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  }

  function navigate(nextView: View, options?: { sessionId?: string | null; bookingStage?: BookingStage; replace?: boolean }) {
    if (typeof window !== 'undefined') {
      const nextPath = nextView === 'admin' ? '/admin' : '/';
      const query = new URLSearchParams();
      if (nextView !== 'home' && nextView !== 'admin') query.set('view', nextView);
      const sessionId = options?.sessionId ?? (nextView === 'detail' || nextView === 'booking' || nextView === 'confirmation' ? selectedSessionId : null);
      if (sessionId) query.set('session', sessionId);
      const stage = options?.bookingStage ?? (nextView === 'booking' ? bookingStage : null);
      if (nextView === 'booking' && stage === 'payment') query.set('stage', 'payment');
      const nextUrl = `${nextPath}${query.toString() ? `?${query.toString()}` : ''}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== nextUrl) window.history[options?.replace ? 'replaceState' : 'pushState']({}, '', nextUrl);
    }
    if (nextView === 'admin' && view !== 'admin') {
      setAdminAuthenticated(false);
      setAdminAuthChecked(false);
    }
    setView(nextView);
    scrollTop();
  }

  function openSignup(prefill: Partial<typeof registrationForm> = {}) {
    setAuthMode('register');
    setAuthError('');
    setRegistrationForm((current) => ({ ...current, ...prefill }));
    navigate('account');
  }

  useEffect(() => {
    const handlePopState = () => {
      const route = routeStateFromLocation();
      if (route.view === 'admin') {
        setAdminAuthenticated(false);
        setAdminAuthChecked(false);
      }
      setView(route.view);
      setSelectedSessionId(route.sessionId);
      setConfirmation(null);
      setBookingStage(route.bookingStage);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function openSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setFormErrors({});
    setPaymentFailed(false);
    setPaymentCancelled(false);
    navigate('detail', { sessionId });
  }

  async function shareSession() {
    if (!selectedSession || !selectedVenue || typeof window === 'undefined') return;
    const shareUrl = window.location.href;
    const shareTitle = `${selectedVenue.name} · ${formatLongDate(selectedSession.date, language)}`;
    setShareNotice('');
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: language === 'zh' ? `来参加 ${shareTitle} 的网球场次。` : `Join this tennis session at ${shareTitle}.`,
          url: shareUrl,
        });
        return;
      }
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareUrl);
      setShareNotice(t.shareCopied);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareNotice(t.shareFailed);
    }
  }

  function openReservationRequest() {
    setRequestForm((current) => ({
      ...current,
      requestType: 'known_venue',
      venueId: null,
      venueName: '',
      postcode: '',
      contactName: current.contactName || user?.name || '',
      email: current.email || user?.email || '',
      phone: current.phone || user?.phone || '',
    }));
    setRequestError('');
    setRequestVenueOpen(false);
    setRequestVenueActiveIndex(-1);
    setSubmittedRequest(null);
    navigate('request');
  }

  sessionsRef.current = sessions;
  openSessionRef.current = openSession;

  useEffect(() => {
    const context = (typeof document === 'undefined'
      ? undefined
      : (document as Document & { modelContext?: ModelContext }).modelContext);
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    const registerTools = async () => {
      try {
        await context.registerTool(
          {
            name: 'list_tennis_sessions',
            title: 'List available tennis sessions',
            description: 'Return published future tennis sessions with times, prices, venues and places left.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: () =>
              sessionsRef.current
                .filter((session) => session.status === 'published' && !isPast(session))
                .sort(sessionSort)
                .map((session) => {
                  const venue = getVenue(session.venueId, venueList);
                  return {
                    id: session.id,
                    venue: venue.name,
                    date: session.date,
                    startTime: session.startTime,
                    endTime: session.endTime,
                    pricePence: session.pricePence,
                    formats: session.formats,
                    placesLeft: Math.max(0, session.capacity - session.bookedSpots),
                  };
                }),
          },
          { signal: lifecycle.signal },
        );
        await context.registerTool(
          {
            name: 'open_tennis_session',
            title: 'Open a tennis session',
            description: 'Open a selected session so the visitor can review details and begin booking.',
            inputSchema: {
              type: 'object',
              properties: { sessionId: { type: 'string' } },
              required: ['sessionId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: (input: unknown) => {
              const sessionId =
                typeof input === 'object' && input !== null && 'sessionId' in input &&
                typeof (input as { sessionId?: unknown }).sessionId === 'string'
                  ? (input as { sessionId: string }).sessionId
                  : '';
              const session = sessionsRef.current.find((item) => item.id === sessionId);
              if (!session || session.status !== 'published' || isPast(session)) {
                throw new Error('Session is unavailable.');
              }
              openSessionRef.current(sessionId);
              return { sessionId, status: 'opened' };
            },
          },
          { signal: lifecycle.signal },
        );
      } catch {
        // Unsupported browsers and registration failures leave the visible UI intact.
      }
    };

    void registerTools();
    return () => lifecycle.abort();
  }, [venueList]);

  function beginBooking() {
    if (!selectedSession || selectedSession.status !== 'published') return;
    if (selectedSession.capacity - selectedSession.bookedSpots < 1) return;
    const preferredBookingFormat = user?.preferredFormat && user.preferredFormat !== 'both' && selectedSession.formats.includes(user.preferredFormat)
      ? user.preferredFormat
      : selectedSession.formats[0] ?? GAME_FORMATS[0];
    setBookingForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      participants: [user?.tennisLevel ?? ''],
      format: preferredBookingFormat,
      racketCount: 0,
      includeFriends: false,
    });
    const defaultCoupon = loyalty?.legacyCouponsEnabled ? availableCoupons[0] : undefined;
    setSelectedCouponId(defaultCoupon?.id ?? '');
    setBookingStage('details');
    setFormErrors({});
    setPaymentFailed(false);
    setPaymentCancelled(false);
    setAdjustmentNotice('');
    paymentSubmittingRef.current = false;
    navigate('booking');
  }

  async function submitReservationRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestBusy) return;
    const validLocation = requestForm.requestType === 'known_venue' ? requestForm.venueName.trim() : /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(requestForm.postcode.trim());
    const valid = validLocation && requestForm.preferredDate >= dateFromToday(0) &&
      requestForm.startTime && requestForm.endTime &&
      parseMinutes(requestForm.endTime) > parseMinutes(requestForm.startTime) &&
      requestForm.contactName.trim() && /^\S+@\S+\.\S+$/.test(requestForm.email);
    if (!valid) {
      setRequestError(t.requestInvalid);
      return;
    }
    setRequestBusy(true);
    setRequestError('');
    try {
      const response = await fetch('/api/reservation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestForm),
      });
      const data = await response.json() as { request?: ReservationRequest };
      if (!response.ok || !data.request) {
        setRequestError(response.status === 400 ? t.requestInvalid : t.dataUnavailable);
        return;
      }
      setSubmittedRequest(data.request);
      setReservationRequests((current) => [data.request as ReservationRequest, ...current]);
      scrollTop();
    } catch {
      setRequestError(t.dataUnavailable);
    } finally {
      setRequestBusy(false);
    }
  }

  function updateRequestVenueName(value: string) {
    const normalizedValue = normalizeLocation(value);
    const matchedVenue = venueList.find((venue) => [venue.name, venue.nameZh].some((name) => normalizeLocation(name) === normalizedValue));
    setRequestForm((current) => ({ ...current, venueName: value, venueId: matchedVenue?.id ?? null }));
    setRequestVenueOpen(true);
    setRequestVenueActiveIndex(-1);
  }

  function selectRequestVenue(venue: Venue) {
    setRequestForm((current) => ({ ...current, venueId: venue.id, venueName: venueLabel(venue) }));
    setRequestVenueOpen(false);
    setRequestVenueActiveIndex(-1);
  }

  function handleRequestVenueKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      if (!requestVenueSuggestions.length) return;
      event.preventDefault();
      setRequestVenueOpen(true);
      setRequestVenueActiveIndex((current) => (current + 1) % requestVenueSuggestions.length);
    } else if (event.key === 'ArrowUp') {
      if (!requestVenueSuggestions.length) return;
      event.preventDefault();
      setRequestVenueOpen(true);
      setRequestVenueActiveIndex((current) => current <= 0 ? requestVenueSuggestions.length - 1 : current - 1);
    } else if (event.key === 'Enter' && requestVenueOpen && requestVenueActiveIndex >= 0) {
      event.preventDefault();
      const venue = requestVenueSuggestions[requestVenueActiveIndex];
      if (venue) selectRequestVenue(venue);
    } else if (event.key === 'Escape') {
      setRequestVenueOpen(false);
      setRequestVenueActiveIndex(-1);
    }
  }

  async function updateReservationRequestStatus(id: string, status: ReservationRequestStatus) {
    if (adminBusy) return;
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

  async function submitUserAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login' ? loginForm : registrationForm;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { user?: UserProfile; error?: string };
      if (!response.ok || !data.user) {
        if (data.error === 'email_exists') setAuthError(t.emailExists);
        else if (data.error === 'invalid_registration') setAuthError(t.registrationInvalid);
        else if (response.status === 401) setAuthError(t.invalidCredentials);
        else setAuthError(t.dataUnavailable);
        return;
      }
      setUser(data.user);
      void loadLoyaltyStatus();
      setUserAuthChecked(true);
      setProfileForm(profileFormFromUser(data.user));
      setProfileEditing(false);
      setProfileError('');
      setLoginForm({ email: data.user.email, password: '' });
      setRegistrationForm((current) => ({ ...current, password: '' }));
    } catch {
      setAuthError(t.dataUnavailable);
    } finally {
      setAuthBusy(false);
    }
  }

  function beginProfileEdit() {
    if (!user) return;
    setProfileForm(profileFormFromUser(user));
    setProfileError('');
    setProfileEditing(true);
  }

  function cancelProfileEdit() {
    if (user) setProfileForm(profileFormFromUser(user));
    setProfileError('');
    setProfileEditing(false);
  }

  async function submitProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileError('');
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      const data = await response.json() as { user?: UserProfile; error?: string };
      if (!response.ok || !data.user) {
        if (data.error === 'email_exists') setProfileError(t.emailExists);
        else if (data.error === 'invalid_profile') setProfileError(t.registrationInvalid);
        else setProfileError(t.profileUpdateFailed);
        return;
      }
      setUser(data.user);
      setProfileForm(profileFormFromUser(data.user));
      setLoginForm({ email: data.user.email, password: '' });
      setProfileEditing(false);
    } catch {
      setProfileError(t.profileUpdateFailed);
    } finally {
      setProfileBusy(false);
    }
  }

  async function logoutUser() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Always clear local account state so a stale UI is not shown.
    }
    setUser(null);
    setLoyalty(null);
    setSelectedCouponId('');
    setAuthMode('login');
    setAuthError('');
    navigate('home');
  }

  function updateGroupSize(value: number) {
    const previousSize = bookingForm.participants.length;
    const racketsWillBeReduced = bookingForm.racketCount > value;
    setBookingForm((current) => {
      const participants = [...current.participants];
      while (participants.length < value) participants.push('');
      while (participants.length > value) participants.pop();
      return {
        ...current,
        participants,
        racketCount: Math.min(current.racketCount, value),
        includeFriends: value > 1 ? true : current.includeFriends,
      };
    });
    setFormErrors((current) => ({ ...current, participants: '' }));
    if (value < previousSize) {
      setAdjustmentNotice(racketsWillBeReduced ? `${t.participantAdjusted} ${t.racketAdjusted}` : t.participantAdjusted);
    } else {
      setAdjustmentNotice('');
    }
  }

  function toggleFriends(enabled: boolean) {
    const hadFriends = bookingForm.participants.length > 1;
    const hadExtraRackets = bookingForm.racketCount > 1;
    if (!enabled && hadFriends) {
      setBookingForm((current) => ({
        ...current,
        includeFriends: false,
        participants: [current.participants[0] ?? ''],
        racketCount: Math.min(current.racketCount, 1),
      }));
      setFormErrors((current) => ({ ...current, participants: '' }));
      setAdjustmentNotice(hadExtraRackets ? `${t.participantAdjusted} ${t.racketAdjusted}` : t.participantAdjusted);
      return;
    }
    setBookingForm((current) => ({
      ...current,
      includeFriends: enabled,
      // Checking the friends option represents adding the first friend.
      // Keep the participant list in sync so their level field is available
      // immediately instead of requiring an extra quantity increment.
      participants: enabled && current.participants.length === 1
        ? [...current.participants, '']
        : current.participants,
    }));
    setFormErrors((current) => ({ ...current, participants: '' }));
    setAdjustmentNotice('');
  }

  function updateParticipant(index: number, level: string) {
    setBookingForm((current) => {
      const participants = [...current.participants];
      participants[index] = level;
      return { ...current, participants };
    });
    setAdjustmentNotice('');
    setFormErrors((current) => ({ ...current, participants: '' }));
  }

  function validateBooking() {
    const errors: Record<string, string> = {};
    if (!bookingForm.name.trim() || !bookingForm.email.trim()) errors.contact = t.allRequired;
    if (bookingForm.email && !/^\S+@\S+\.\S+$/.test(bookingForm.email)) errors.email = t.validEmail;
    if (!selectedSession || !bookingForm.format || !selectedSession.formats.includes(bookingForm.format)) errors.format = t.chooseFormat;
    if (bookingForm.participants.some((level) => !level)) errors.participants = t.chooseLevels;
    if (
      selectedSession &&
      bookingForm.participants.length > selectedSession.capacity - selectedSession.bookedSpots
    ) {
      errors.participants = t.notEnoughSpots;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function continueToPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validateBooking()) {
      setPaymentFailed(false);
      setPaymentCancelled(false);
      setBookingStage('payment');
      navigate('booking', { bookingStage: 'payment' });
      scrollTop();
    }
  }

  async function completePayment() {
    if (paymentSubmittingRef.current) return;
    paymentSubmittingRef.current = true;
    setCheckoutLoading(true);
    setPaymentFailed(false);
    setPaymentCancelled(false);
    if (!selectedSession) {
      paymentSubmittingRef.current = false;
      setCheckoutLoading(false);
      return;
    }
    const liveSession = sessions.find((session) => session.id === selectedSession.id);
    const formatUnavailable = !bookingForm.format || !liveSession?.formats.includes(bookingForm.format);
    if (
      !liveSession ||
      liveSession.status !== 'published' ||
      isPast(liveSession) ||
      formatUnavailable ||
      bookingForm.participants.length > liveSession.capacity - liveSession.bookedSpots
    ) {
      paymentSubmittingRef.current = false;
      setCheckoutLoading(false);
      setBookingStage('details');
      setFormErrors(formatUnavailable ? { format: t.chooseFormat } : { participants: t.notEnoughSpots });
      return;
    }
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: liveSession.id,
          name: bookingForm.name,
          email: bookingForm.email,
          phone: bookingForm.phone,
          participants: bookingForm.participants,
          format: bookingForm.format,
          racketCount: racketRentalEnabled ? bookingForm.racketCount : 0,
          couponId: selectedCoupon?.id ?? '',
        }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) {
        if (response.status === 409) {
          if (data.error === 'format_unavailable') {
            setBookingStage('details');
            setFormErrors({ format: t.chooseFormat });
          }
          else if (data.error === 'coupon_unavailable' || data.error === 'coupon_requires_account') {
            setSelectedCouponId('');
            void loadLoyaltyStatus();
            setPaymentFailed(true);
          } else {
            setBookingStage('details');
            setFormErrors({ participants: t.notEnoughSpots });
          }
        } else {
          setPaymentFailed(true);
        }
        paymentSubmittingRef.current = false;
        setCheckoutLoading(false);
        return;
      }
      window.sessionStorage.setItem('tennis-social-checkout-draft-v1', JSON.stringify({
        sessionId: liveSession.id,
        bookingForm,
      }));
      window.location.assign(data.checkoutUrl);
    } catch {
      paymentSubmittingRef.current = false;
      setCheckoutLoading(false);
      setPaymentFailed(true);
    }
  }

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
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
        setAdminAuthError(t.invalidCredentials);
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
    setAdminAuthenticated(false);
    setAdminAuthChecked(true);
    navigate('home');
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

  async function saveVenue(event: FormEvent<HTMLFormElement>) {
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

  async function resetDemo() {
    if (!window.confirm(t.resetConfirm)) return;
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    let resetFromServer = false;
    let resetUnauthorized = false;
    let nextVenues = venueList;
    try {
      const response = await fetch('/api/admin/reset', { method: 'POST' });
      if (response.status === 401) {
        resetUnauthorized = true;
        setAdminAuthenticated(false);
      }
      if (response.ok) {
        const data = await response.json() as { venues?: unknown[]; sessions?: Session[]; bookings?: Booking[] };
        const resetVenues = data.venues?.map(normalizeVenue).filter((venue): venue is Venue => Boolean(venue));
        if (data.sessions && data.bookings) {
          setSessions(data.sessions);
          setBookings(data.bookings);
          if (resetVenues?.length) {
            nextVenues = resetVenues;
            setVenueList(resetVenues);
          }
          resetFromServer = true;
        }
      }
    } catch {
      // Keep the dashboard state unchanged when the server reset is unavailable.
    }
    if (resetUnauthorized) {
      adminBusyRef.current = false;
      setAdminBusy(false);
      return;
    }
    if (!resetFromServer) {
      setAdminMessage(t.adminSaveUnavailable);
      adminBusyRef.current = false;
      setAdminBusy(false);
      return;
    }
    setConfirmation(null);
    setSelectedSessionId(null);
    setDraft(emptyDraft(nextVenues));
    setVenueDraft(emptyVenueDraft(nextVenues));
    setAdminMessage(t.resetDone);
    paymentSubmittingRef.current = false;
    cancellingBookingRef.current.clear();
    adminBusyRef.current = false;
    setAdminBusy(false);
    navigate('admin');
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
      description: session.description,
      descriptionZh: session.descriptionZh,
      status: session.status,
    });
    setAdminMessage('');
  }

  function sessionOverlaps(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) {
    return parseMinutes(a.startTime) < parseMinutes(b.endTime) && parseMinutes(b.startTime) < parseMinutes(a.endTime);
  }

  function sessionPayload(session: Session, status = session.status) {
    return {
      venueId: session.venueId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      pricePence: session.pricePence,
      capacity: session.capacity,
      formats: session.formats,
      seekingLevels: session.seekingLevels ?? [],
      description: session.description,
      descriptionZh: session.descriptionZh,
      status,
    };
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
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
      !draft.description.trim() ||
      !draft.descriptionZh.trim() ||
      !Number.isFinite(pricePence) ||
      pricePence < 0 ||
      !Number.isInteger(capacity) ||
      capacity < 1
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
      description: draft.description.trim(),
      descriptionZh: draft.descriptionZh.trim(),
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
    setUndoSessions(sessions);
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
            description: session.description,
            descriptionZh: session.descriptionZh,
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
      const candidate = { ...session, id: '', date: shiftDate(session.date, week * 7), bookedSpots: 0 };
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
      setUndoSessions(sessions);
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

  async function undoLastOperation() {
    if (!undoSessions) {
      setAdminMessage(t.noOperationToUndo);
      return;
    }
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    const previousById = new Map(undoSessions.map((session) => [session.id, session]));
    const currentChanged = sessions.filter((session) => previousById.has(session.id));
    const createdSinceSnapshot = sessions.filter((session) => !previousById.has(session.id));
    await Promise.all(currentChanged.map(async (session) => {
      const previous = previousById.get(session.id);
      if (!previous) return;
      try {
        await fetch(`/api/admin/sessions/${encodeURIComponent(session.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sessionPayload(previous)) });
      } catch {
        // Keep the local state in sync with the saved snapshot when offline.
      }
    }));
    await Promise.all(createdSinceSnapshot.map(async (session) => {
      try {
        await fetch(`/api/admin/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' });
      } catch {
        // The local snapshot is still restored if the server is unavailable.
      }
    }));
    setSessions(undoSessions);
    setUndoSessions(null);
    setAdminMessage(t.operationUndone);
    adminBusyRef.current = false;
    setAdminBusy(false);
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

  async function cancelBooking(bookingId: string) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (
      !booking ||
      booking.status === 'cancelled' ||
      cancellingBookingRef.current.has(bookingId) ||
      !window.confirm(t.cancelConfirm)
    ) return;
    cancellingBookingRef.current.add(bookingId);
    adminBusyRef.current = true;
    ++sessionLoadVersion.current;
    setAdminBusy(true);
    let cancelledOnServer = false;
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (response.ok) cancelledOnServer = true;
      else setAdminMessage(t.adminSaveUnavailable);
    } catch {
      setAdminMessage(t.adminSaveUnavailable);
    }
    if (cancelledOnServer) {
      setBookings((current) => current.map((item) => (item.id === bookingId ? { ...item, status: 'cancelled' } : item)));
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
    adminBusyRef.current = false;
    setAdminBusy(false);
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
        if (!data.racketRentalEnabled) setBookingForm((current) => ({ ...current, racketCount: 0 }));
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

  function setLanguage(nextLanguage: Language) {
    setLanguageValue(nextLanguage);
  }

  const publishedCount = sessions.filter((s) => s.status === 'published' && !isPast(s)).length;
  const openSpots = upcomingSessions.reduce((sum, s) => sum + Math.max(0, s.capacity - s.bookedSpots), 0);

  return (
    <div className="app-shell">
      <SiteHeader
        language={language}
        onLanguageChange={setLanguage}
        user={user}
        activeView={view}
        onNavigate={navigate}
        brandTag={t.brandTag}
        accountLabel={t.account}
      />
      <main>
        {view === "home" ? (
          <HomeView
            upcomingSessions={upcomingSessions}
            sessionsReady={sessionsReady}
            venueList={venueList}
            bookings={bookings}
            language={language}
            t={t}
            onOpenSession={openSession}
            onOpenReservationRequest={openReservationRequest}
            onScrollToSessions={scrollToSessions}
          />
        ) : null}
        {view === "detail" && selectedSession && selectedVenue ? (
          <DetailView
            selectedSession={selectedSession}
            selectedVenue={selectedVenue}
            language={language}
            t={t}
            shareNotice={shareNotice}
            onNavigateHome={() => navigate("home")}
            onShareSession={() => void shareSession()}
            onBeginBooking={beginBooking}
          />
        ) : null}
        {view === "booking" && selectedSession && selectedVenue ? (
          <BookingView
            bookingStage={bookingStage}
            selectedSession={selectedSession}
            selectedVenue={selectedVenue}
            bookingForm={bookingForm}
            setBookingForm={setBookingForm}
            formErrors={formErrors}
            setFormErrors={setFormErrors}
            user={user}
            loyalty={loyalty}
            availableCoupons={availableCoupons}
            selectedCoupon={selectedCoupon}
            selectedCouponId={selectedCouponId}
            setSelectedCouponId={setSelectedCouponId}
            paymentFailed={paymentFailed}
            paymentCancelled={paymentCancelled}
            checkoutLoading={checkoutLoading}
            adjustmentNotice={adjustmentNotice}
            loyaltyDiscountPence={loyaltyDiscountPence}
            couponDiscountPence={couponDiscountPence}
            permanentDiscountPercent={permanentDiscountPercent}
            totalPence={totalPence}
            racketRentalEnabled={racketRentalEnabled}
            language={language}
            t={t}
            onNavigate={navigate}
            onOpenSignup={openSignup}
            onToggleFriends={toggleFriends}
            onUpdateGroupSize={updateGroupSize}
            onUpdateParticipant={updateParticipant}
            onContinueToPayment={continueToPayment}
            onCompletePayment={() => void completePayment()}
          />
        ) : null}
        {view === "confirmation" && confirmation ? (
          <ConfirmationView
            confirmation={confirmation}
            sessions={sessions}
            venueList={venueList}
            user={user}
            confirmationEmailStatus={confirmationEmailStatus}
            racketRentalEnabled={racketRentalEnabled}
            language={language}
            t={t}
            onNavigateHome={() => navigate("home")}
            onOpenSignup={openSignup}
          />
        ) : null}
        {view === "confirmation" && !confirmation ? (
          <section className="page-width loading-state" aria-live="polite">
            <p>{t.loadingSessions}</p>
          </section>
        ) : null}
        {view === "account" ? (
          <AccountView
            userAuthChecked={userAuthChecked}
            user={user}
            profileEditing={profileEditing}
            profileBusy={profileBusy}
            profileError={profileError}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            onSubmitProfileUpdate={submitProfileUpdate}
            onBeginProfileEdit={beginProfileEdit}
            onCancelProfileEdit={cancelProfileEdit}
            onLogout={() => void logoutUser()}
            loyalty={loyalty}
            loyaltyLoading={loyaltyLoading}
            authMode={authMode}
            setAuthMode={setAuthMode}
            authBusy={authBusy}
            authError={authError}
            loginForm={loginForm}
            setLoginForm={setLoginForm}
            registrationForm={registrationForm}
            setRegistrationForm={setRegistrationForm}
            onSubmitUserAuth={submitUserAuth}
            language={language}
            t={t}
            onNavigateHome={() => navigate("home")}
          />
        ) : null}
        {view === "request" ? (
          <RequestView
            submittedRequest={submittedRequest}
            requestForm={requestForm}
            setRequestForm={setRequestForm}
            requestBusy={requestBusy}
            requestError={requestError}
            requestVenueOpen={requestVenueOpen}
            setRequestVenueOpen={setRequestVenueOpen}
            requestVenueActiveIndex={requestVenueActiveIndex}
            requestVenueSuggestions={requestVenueSuggestions}
            venueList={venueList}
            user={user}
            language={language}
            t={t}
            onSubmit={submitReservationRequest}
            onNavigateHome={() => navigate("home")}
            onOpenSignup={openSignup}
            onUpdateVenueName={updateRequestVenueName}
            onSelectVenue={selectRequestVenue}
            onKeyDown={handleRequestVenueKeyDown}
          />
        ) : null}
        {view === "admin" ? (
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
            sessions={sessions}
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
            undoSessions={undoSessions}
            sessionImportInput={sessionImportInput}
            sessionImportMessage={sessionImportMessage}
            sessionImportFailed={sessionImportFailed}
            language={language}
            t={t}
            onResetDemo={() => void resetDemo()}
            onLogoutAdmin={() => void logoutAdmin()}
            onSaveDraft={saveDraft}
            onSaveVenue={saveVenue}
            onChooseVenueImage={chooseVenueImage}
            onReuseVenuePhoto={reuseVenuePhoto}
            onApplyVenueDefaultPrice={applyVenueDefaultPrice}
            onStartEditSession={startEdit}
            onCreateRecurringSessions={(session) => void createRecurringSessions(session)}
            onDeleteSession={(session) => void deleteSession(session)}
            onBulkUpdateSessionStatus={(status) => void bulkUpdateSessionStatus(status)}
            onExportSessions={exportSessions}
            onUndoLastOperation={() => void undoLastOperation()}
            onImportSessions={(event) => void importSessions(event)}
            onCancelBooking={(id) => void cancelBooking(id)}
            onUpdateReservationRequestStatus={(id, status) => void updateReservationRequestStatus(id, status)}
            onStartEditVenue={startEditVenue}
            onDeleteVenue={(venue) => void deleteVenue(venue)}
          />
        ) : null}
      </main>
      <footer className="site-footer page-width">
        <span>
          <AppMark /> Tennis Match
        </span>
        <small>{t.demoNotice}</small>
        {view === 'home' ? <button type="button" className="admin-footer-link" onClick={() => navigate('admin')}>{t.adminPortal ?? (language === 'zh' ? '管理平台' : 'Admin portal')}</button> : null}
      </footer>
      {view === 'home' ? <BookingChat language={language} /> : null}
    </div>
  );
}

export default function Home() {
  return <TennisSocialApp />;
}
