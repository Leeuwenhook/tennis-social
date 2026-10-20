'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type SubmitEvent, type KeyboardEvent } from "react";

import { AppMark } from "@/components/app-mark";
import { SiteHeader } from "@/components/site-header";
import { SiteAnalytics } from "@/components/site-analytics";
import { AccountView } from "@/components/views/account-view";
import { BookingView } from "@/components/views/booking-view";
import { ConfirmationView } from "@/components/views/confirmation-view";
import { DetailView } from "@/components/views/detail-view";
import { CourtsideHomeView } from "@/components/views/courtside-home-view";
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
import { formatLongDate, parseMinutes } from "@/lib/formatters";
import { withPartnerCourtBooked } from "@/lib/partner-request-slots";
import {
  SESSION_RECOVERY_STORAGE_KEY,
  BOOKING_STORAGE_KEY,
  dateFromToday,
  getVenue,
  isPast,
  availableSpots,
  LANGUAGE_STORAGE_KEY,
  LEVELS,
  normalizeBooking,
  normalizeLocation,
  normalizeSession,
  normalizeVenue,
  profileFormFromUser,
  routeStateFromLocation,
  SESSION_STORAGE_KEY,
  sessionSort,
  VENUE_STORAGE_KEY,
  venueLabel,
  venueSearchText,
} from "@/lib/tennis-utils";
import { translations } from "@/lib/translations";
import type {
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
  Session,
  UserProfile,
  View,
} from "@/types/tennis";

const seededSessions: Session[] = createDemoSessions();
const seededBookings: Booking[] = createDemoBookings(seededSessions);

export function TennisSocialApp() {
  const [language, setLanguageValue] = useState<Language>('en');
  const [venueList, setVenueList] = useState<Venue[]>(venues);
  const [sessions, setSessions] = useState<Session[]>(seededSessions);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>(seededBookings);
  const [hydrated, setHydrated] = useState(false);
  const [initialRoute] = useState<{ view: View; sessionId: string | null; bookingStage: BookingStage }>(() => routeStateFromLocation());
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
  const [racketRentalEnabled, setRacketRentalEnabled] = useState(false);
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
    preferredDate: '',
    startTime: '',
    endTime: '',
    preferredSlots: [],
    wechat: '', whatsapp: '', preferredContact: 'email',
    contactName: '',
    email: '',
    phone: '',
    message: '',
    requestKind: 'find_both',
    venueBookingStatus: 'unknown',
    existingPlayerLevels: [],
    seekingPlayerCount: 1,
    seekingLevels: [],
    preferredFormat: 'flexible',
    budgetPence: null,
  });
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestVenueOpen, setRequestVenueOpen] = useState(false);
  const [requestVenueActiveIndex, setRequestVenueActiveIndex] = useState(-1);
  const [submittedRequest, setSubmittedRequest] = useState<ReservationRequest | null>(null);
  const sessionsRef = useRef(sessions);
  const sessionLoadVersion = useRef(0);
  const openSessionRef = useRef<(sessionId: string) => void>(() => undefined);
  const paymentSubmittingRef = useRef(false);

  const t = translations[language];
  const requestVenueSuggestions = useMemo(() => {
    const query = normalizeLocation(requestForm.venueName);
    const pickable = venueList.filter((venue) => !venue.archivedAt);
    const matches = query
      ? pickable.filter((venue) => venueSearchText(venue).includes(query))
      : pickable;
    return matches.slice(0, 8);
  }, [requestForm.venueName, venueList]);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedVenue = selectedSession ? getVenue(selectedSession.venueId, venueList) : null;
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
      const savedSessions = legacySessions;
      const savedBookings = window.localStorage.getItem(BOOKING_STORAGE_KEY);
      const savedVenues = window.localStorage.getItem(VENUE_STORAGE_KEY);
      const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions) as Session[];
        // oxlint-disable-next-line react/react-compiler -- hydrate from localStorage after mount to keep SSR markup consistent
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount with the initial route
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

  // Responses started by an earlier load are stale.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const load = async () => {
      const version = ++sessionLoadVersion.current;
      try {
        const response = await fetch('/api/sessions', { cache: 'no-store' });
        if (cancelled || version !== sessionLoadVersion.current) return;
        if (!response.ok) throw new Error('sessions_unavailable');
        const data = await response.json() as { sessions?: Session[] };
        if (!Array.isArray(data.sessions)) throw new Error('invalid_sessions');
        if (!cancelled && version === sessionLoadVersion.current) {
          setSessions(data.sessions.map(normalizeSession));
        }
      } catch {
        // The cached sessions stay visible if the server is unavailable.
      } finally {
        if (!cancelled && version === sessionLoadVersion.current) setSessionsReady(true);
      }
    };
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const sync = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY) void load();
    };
    void load();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', sync);
    return () => {
      cancelled = true;
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- bump the version so in-flight loads from this effect are ignored
      ++sessionLoadVersion.current;
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', sync);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
      window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(bookings));
      window.localStorage.setItem(VENUE_STORAGE_KEY, JSON.stringify(venueList));
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Browser storage is only a cache; database saves do not depend on it.
    }
  }, [bookings, hydrated, language, sessions, venueList]);

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
      const nextPath = '/';
      const query = new URLSearchParams();
      if (nextView !== 'home') query.set('view', nextView);
      const sessionId = options?.sessionId ?? (nextView === 'detail' || nextView === 'booking' || nextView === 'confirmation' ? selectedSessionId : null);
      if (sessionId) query.set('session', sessionId);
      const stage = options?.bookingStage ?? (nextView === 'booking' ? bookingStage : null);
      if (nextView === 'booking' && stage === 'payment') query.set('stage', 'payment');
      const nextUrl = `${nextPath}${query.toString() ? `?${query.toString()}` : ''}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== nextUrl) window.history[options?.replace ? 'replaceState' : 'pushState']({}, '', nextUrl);
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
    setRequestForm((current) => {
      const requestKind = current.requestKind ?? 'find_both';
      const findCourtOnly = requestKind === 'find_court';
      return {
      ...current,
      requestType: findCourtOnly ? 'find_nearby' : 'known_venue',
      venueId: null,
      venueName: '',
      postcode: findCourtOnly ? (user?.postcode ?? '') : '',
      contactName: current.contactName || user?.name || '',
      email: current.email || user?.email || '',
      phone: current.phone || user?.phone || '',
      requestKind,
      venueBookingStatus: current.venueBookingStatus ?? 'unknown',
      existingPlayerLevels: current.existingPlayerLevels ?? [],
      seekingPlayerCount: findCourtOnly ? 0 : Math.max(1, current.seekingPlayerCount ?? 1),
      seekingLevels: current.seekingLevels ?? [],
      preferredFormat: current.preferredFormat ?? 'flexible',
      budgetPence: current.budgetPence ?? null,
      };
    });
    setRequestError('');
    setRequestVenueOpen(false);
    setRequestVenueActiveIndex(-1);
    setSubmittedRequest(null);
    navigate('request');
  }

  useLayoutEffect(() => {
    sessionsRef.current = sessions;
    openSessionRef.current = openSession;
  });

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
                    placesLeft: availableSpots(session),
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
    if (availableSpots(selectedSession) < 1) return;
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

  async function submitReservationRequest(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestBusy) return;
    const requestPayload = withPartnerCourtBooked(requestForm);
    const validLocation = requestForm.requestType === 'known_venue' ? requestForm.venueName.trim() : /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(requestForm.postcode.trim());
    const structured = requestForm.requestKind !== undefined;
    const validStructured = !structured || (
      ['find_partners', 'find_court', 'find_both'].includes(requestForm.requestKind ?? '') &&
      ['booked', 'not_booked', 'unknown'].includes(requestPayload.venueBookingStatus ?? '') &&
      ['singles', 'doubles', 'practice', 'flexible'].includes(requestForm.preferredFormat ?? '') &&
      Number.isInteger(requestForm.seekingPlayerCount) && (requestForm.seekingPlayerCount ?? -1) >= 0 &&
      (requestForm.existingPlayerLevels ?? []).every((level) => LEVELS.includes(level as never)) &&
      (requestForm.seekingLevels ?? []).every((level) => LEVELS.includes(level as never)) &&
      (requestForm.budgetPence == null || (Number.isInteger(requestForm.budgetPence) && requestForm.budgetPence >= 0))
    );
    if (structured && requestForm.requestKind === 'find_partners' && requestForm.requestType !== 'known_venue') {
      setRequestError(t.requestKindNeedsVenue);
      return;
    }
    const seekingCount = requestForm.seekingPlayerCount ?? -1;
    if (structured && Number.isInteger(seekingCount) && (requestForm.requestKind === 'find_court' ? seekingCount !== 0 : seekingCount < 1)) {
      setRequestError(t.requestSeekingCountInvalid);
      return;
    }
    const valid = validLocation && validStructured && requestForm.preferredDate >= dateFromToday(0) && (requestPayload.venueBookingStatus === 'booked'
        ? requestForm.startTime && requestForm.endTime && parseMinutes(requestForm.endTime) > parseMinutes(requestForm.startTime)
        : (requestForm.preferredSlots ?? []).length > 0) &&
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
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json() as { request?: ReservationRequest };
      if (!response.ok || !data.request) {
        setRequestError(response.status === 400 ? t.requestInvalid : t.dataUnavailable);
        return;
      }
      setSubmittedRequest(data.request);
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


  async function submitUserAuth(event: SubmitEvent<HTMLFormElement>) {
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

  async function submitProfileUpdate(event: SubmitEvent<HTMLFormElement>) {
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
      bookingForm.participants.length > availableSpots(selectedSession)
    ) {
      errors.participants = t.notEnoughSpots;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function continueToPayment(event: SubmitEvent<HTMLFormElement>) {
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
      bookingForm.participants.length > availableSpots(liveSession)
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






















  function setLanguage(nextLanguage: Language) {
    setLanguageValue(nextLanguage);
  }


  return (
    <div className="app-shell">
      {/* Views change only the query string, so report each view as its own
          route; the path never carries query parameters such as checkout ids. */}
      <SiteAnalytics
        route={view === "home" ? "/" : `/${view}`}
        path={view === "home" ? "/" : `/${view}${selectedSessionId && (view === "detail" || view === "booking") ? `/${selectedSessionId}` : ""}`}
      />
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
          <CourtsideHomeView
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
      </main>
      <footer className="site-footer page-width">
        <span>
          <AppMark /> Tennis Match
        </span>
        <small>{t.demoNotice}</small>
        {/* oxlint-disable-next-line next/no-html-link-for-pages -- the admin is a separate app; a full page load is intended */}
        {view === 'home' ? <a className="admin-footer-link" href="/admin">{t.adminPortal ?? (language === 'zh' ? '管理平台' : 'Admin portal')}</a> : null}
      </footer>
      {view === 'home' ? <BookingChat language={language} onAuthenticated={(authenticatedUser) => {
        setUser(authenticatedUser);
        setUserAuthChecked(true);
        setProfileForm(profileFormFromUser(authenticatedUser));
        setProfileEditing(false);
        setProfileError('');
        setLoginForm({ email: authenticatedUser.email, password: '' });
        setRegistrationForm((current) => ({ ...current, password: '' }));
        void loadLoyaltyStatus();
      }} /> : null}
    </div>
  );
}

export default function Home() {
  return <TennisSocialApp />;
}
