'use client';

import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.mjs';
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot.mjs';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.mjs';
import Globe2 from 'lucide-react/dist/esm/icons/globe-2.mjs';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.mjs';
import Minus from 'lucide-react/dist/esm/icons/minus.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.mjs';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2.mjs';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.mjs';
import Timer from 'lucide-react/dist/esm/icons/timer.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createDemoBookings,
  createDemoSessions,
  GAME_FORMATS,
  RACKET_PRICE_PENCE,
  venues,
  type GameFormat,
  type Venue,
} from '@/lib/demo-data';

type Language = 'en' | 'zh';
type View = 'home' | 'detail' | 'booking' | 'confirmation' | 'admin';
type BookingStage = 'details' | 'payment';
type AdminTab = 'sessions' | 'bookings';
type SessionStatus = 'published' | 'draft';
type BookingStatus = 'pending_payment' | 'confirmed' | 'expired' | 'payment_failed' | 'cancelled' | 'refunded';

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title?: string;
      description: string;
      inputSchema: object;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
      execute: (input: unknown) => unknown;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

type Session = {
  id: string;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  pricePence: number;
  capacity: number;
  bookedSpots: number;
  formats: GameFormat[];
  status: SessionStatus;
  description: string;
  descriptionZh: string;
};

type Booking = {
  id: string;
  sessionId: string;
  contactName: string;
  email: string;
  phone: string;
  participants: string[];
  format: GameFormat;
  racketCount: number;
  totalPence: number;
  status: BookingStatus;
  createdAt: string;
};

type SessionDraft = {
  id: string | null;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  price: string;
  capacity: string;
  formats: GameFormat[];
  description: string;
  descriptionZh: string;
  status: SessionStatus;
};

const LEVELS = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];
const SESSION_STORAGE_KEY = 'tennis-social-sessions-v2';
const BOOKING_STORAGE_KEY = 'tennis-social-bookings-v2';
const LANGUAGE_STORAGE_KEY = 'tennis-social-language-v1';

const seededSessions: Session[] = createDemoSessions();

const seededBookings: Booking[] = createDemoBookings(seededSessions);

const translations = {
  en: {
    sessions: 'Sessions',
    admin: 'Demo admin',
    brandTag: 'London tennis community',
    eyebrow: 'FIND YOUR NEXT COURT',
    headline: 'Good tennis is better together.',
    intro:
      'Friendly, organised tennis sessions across London. Pick a time, meet a few players and get on court.',
    upcoming: 'Upcoming sessions',
    upcomingIntro: 'Choose a time that works for you. Every session is open to all levels.',
    allLevels: 'All levels welcome',
    noSignUp: 'No account needed',
    courtReady: 'Court booked for you',
    spotsLeft: 'spots left',
    spotLeft: 'spot left',
    full: 'Full',
    bookNow: 'Book a place',
    viewDetails: 'View details',
    back: 'Back to sessions',
    aboutSession: 'About this session',
    sessionDetails: 'Session details',
    date: 'Date',
    time: 'Time',
    location: 'Location',
    duration: 'Duration',
    pricePerPerson: 'Price per person',
    format: 'Format',
    formats: 'Formats',
    singles: 'Singles',
    doubles: 'Doubles',
    availableFormats: 'Available formats',
    chooseFormat: 'Choose a format.',
    chooseAtLeastOneFormat: 'Choose at least one format.',
    availability: 'Availability',
    noLevelLimit: 'No level limit for this session',
    bringFriends: 'Bring friends',
    bookYourPlace: 'Book your place',
    contactDetails: 'Contact details',
    contactIntro: 'We only need one contact for the group.',
    name: 'Name',
    email: 'Email',
    phone: 'SMS / phone number',
    optional: 'optional',
    tennisLevel: 'Tennis level',
    yourLevel: 'Your level',
    groupSize: 'People in your group',
    person: 'person',
    people: 'people',
    friendLevel: 'Friend level',
    addFriends: 'I’m booking for friends too',
    rental: 'Racket rental',
    rentalIntro: 'Need a racket? Add one for £2 each.',
    rackets: 'rackets',
    racket: 'racket',
    orderSummary: 'Order summary',
    sessionFee: 'Session fee',
    racketFee: 'Racket rental',
    total: 'Total',
    continuePayment: 'Continue to payment',
    payment: 'Payment',
    paymentIntro: 'Your place will be held for 30 minutes while you pay.',
    demoPayment: 'Secure checkout',
    demoPaymentIntro: 'Continue to Stripe to pay by card, Apple Pay or Google Pay when available.',
    simulateSuccess: 'Pay securely with Stripe',
    simulateFailure: 'Simulate failed payment',
    paymentFailed: 'We could not start the secure checkout. Your details are still here, so you can try again.',
    paymentCancelled: 'Checkout was cancelled. Your details are still here if you want to try again.',
    confirmed: 'Booking confirmed',
    confirmationIntro: 'You’re booked in. Keep this reference for the session.',
    bookingReference: 'Booking reference',
    contact: 'Contact',
    participants: 'Participants',
    level: 'level',
    levels: 'levels',
    bookingConfirmed: 'Confirmed',
    actions: 'Actions',
    demoNotice: 'Payment is securely processed by Stripe. We never receive your card details.',
    browseMore: 'Browse more sessions',
    adminTitle: 'Demo admin',
    adminIntro: 'Manage the shared demo schedule and inspect test bookings.',
    manageSessions: 'Manage sessions',
    viewBookings: 'View bookings',
    addSession: 'Add session',
    editSession: 'Edit session',
    saveSession: 'Save session',
    cancelEdit: 'Cancel edit',
    status: 'Status',
    published: 'Published',
    draft: 'Draft',
    capacity: 'Capacity',
    booked: 'Booked',
    activeBookings: 'active bookings',
    edit: 'Edit',
    bookingList: 'Booking list',
    bookingListIntro: 'Confirmed and cancelled demo bookings appear here.',
    cancelBooking: 'Cancel booking',
    cancelled: 'Cancelled',
    cancelConfirm: 'Cancel this booking and release its places?',
    resetDemo: 'Reset demo data',
    resetConfirm: 'Reset sessions and bookings to the original demo data?',
    resetDone: 'Demo data reset.',
    sessionSaved: 'Session saved.',
    allRequired: 'Please complete the required fields.',
    validEmail: 'Enter a valid email address.',
    chooseLevels: 'Choose a level for every participant.',
    notEnoughSpots: 'There are not enough places left for this group.',
    participantAdjusted: 'The last participant level field was removed to match your group size.',
    racketAdjusted: 'Racket rental was adjusted to match your group size.',
    endBeforeStart: 'End time must be after start time.',
    cannotReduceCapacity: 'Capacity cannot be below confirmed bookings.',
    lockedFields: 'Venue, date, time and price are locked while this session has active bookings.',
    emptyBookings: 'No bookings yet.',
    saveFailed: 'Please check the session details.',
    saving: 'Saving…',
    pendingPayment: 'Payment pending',
    expired: 'Expired',
    paymentFailedStatus: 'Payment failed',
    refunded: 'Refunded',
    dataUnavailable: 'The shared demo data is unavailable right now.',
    london: 'London time',
  },
  zh: {
    sessions: '场次',
    admin: '演示后台',
    brandTag: '伦敦网球社群',
    eyebrow: '寻找下一场约球',
    headline: '一起打球，会更开心。',
    intro: '在伦敦各处参加轻松、有组织的网球活动。选一个时间，认识球友，然后上场。',
    upcoming: '即将开始的场次',
    upcomingIntro: '选择适合你的时间。每场活动都欢迎不同水平的球友。',
    allLevels: '欢迎所有水平',
    noSignUp: '无需注册账号',
    courtReady: '已为你预订场地',
    spotsLeft: '个名额剩余',
    spotLeft: '个名额剩余',
    full: '已满员',
    bookNow: '报名参加',
    viewDetails: '查看详情',
    back: '返回场次列表',
    aboutSession: '活动介绍',
    sessionDetails: '场次详情',
    date: '日期',
    time: '时间',
    location: '地点',
    duration: '时长',
    pricePerPerson: '每人价格',
    format: '比赛形式',
    formats: '比赛形式',
    singles: '单打',
    doubles: '双打',
    availableFormats: '可选比赛形式',
    chooseFormat: '请选择单打或双打。',
    chooseAtLeastOneFormat: '请至少选择一种比赛形式。',
    availability: '名额情况',
    noLevelLimit: '本场暂不设水平限制',
    bringFriends: '带朋友一起',
    bookYourPlace: '填写报名信息',
    contactDetails: '联系人信息',
    contactIntro: '一组报名只需要填写一位联系人。',
    name: '姓名',
    email: '邮箱',
    phone: 'SMS 手机号码',
    optional: '选填',
    tennisLevel: '网球水平',
    yourLevel: '你的水平',
    groupSize: '报名人数',
    person: '人',
    people: '人',
    friendLevel: '朋友水平',
    addFriends: '我还要替朋友报名',
    rental: '租借球拍',
    rentalIntro: '需要球拍吗？每支 £2。',
    rackets: '支球拍',
    racket: '支球拍',
    orderSummary: '费用明细',
    sessionFee: '场次费用',
    racketFee: '球拍租借',
    total: '总计',
    continuePayment: '继续付款',
    payment: '付款',
    paymentIntro: '付款期间将为你保留名额 30 分钟。',
    demoPayment: '安全付款',
    demoPaymentIntro: '前往 Stripe 使用银行卡付款；设备支持时也可使用 Apple Pay 或 Google Pay。',
    simulateSuccess: '使用 Stripe 安全付款',
    simulateFailure: '模拟付款失败',
    paymentFailed: '暂时无法开始安全付款。你的信息仍然保留，可以再次尝试。',
    paymentCancelled: '你已取消付款。报名信息仍然保留，可以再次尝试。',
    confirmed: '报名成功',
    confirmationIntro: '你已报名成功，请保存这个编号。',
    bookingReference: '报名编号',
    contact: '联系人',
    participants: '参与者',
    level: '水平',
    levels: '水平',
    bookingConfirmed: '已确认',
    actions: '操作',
    demoNotice: '付款由 Stripe 安全处理，我们不会接触你的银行卡信息。',
    browseMore: '浏览更多场次',
    adminTitle: '演示后台',
    adminIntro: '管理共享演示场次，并查看测试报名。',
    manageSessions: '管理场次',
    viewBookings: '查看报名',
    addSession: '新增场次',
    editSession: '编辑场次',
    saveSession: '保存场次',
    cancelEdit: '取消编辑',
    status: '状态',
    published: '已发布',
    draft: '草稿',
    capacity: '总名额',
    booked: '已报名',
    activeBookings: '笔有效报名',
    edit: '编辑',
    bookingList: '报名列表',
    bookingListIntro: '已确认和已取消的演示报名会显示在这里。',
    cancelBooking: '取消报名',
    cancelled: '已取消',
    cancelConfirm: '取消这笔报名并释放相应名额？',
    resetDemo: '重置演示数据',
    resetConfirm: '将场次和报名恢复为初始演示数据？',
    resetDone: '演示数据已重置。',
    sessionSaved: '场次已保存。',
    allRequired: '请填写所有必填项。',
    validEmail: '请输入有效的邮箱地址。',
    chooseLevels: '请为每位参与者选择水平。',
    notEnoughSpots: '该组人数超过当前剩余名额。',
    participantAdjusted: '已移除最后一位参与者的水平字段，以匹配当前报名人数。',
    racketAdjusted: '租拍数量已同步调整为不超过报名人数。',
    endBeforeStart: '结束时间必须晚于开始时间。',
    cannotReduceCapacity: '总名额不能低于已有的有效报名人数。',
    lockedFields: '该场次已有有效报名，场地、日期、时间和价格已锁定。',
    emptyBookings: '还没有报名记录。',
    saveFailed: '请检查场次信息。',
    saving: '保存中…',
    pendingPayment: '待付款',
    expired: '已过期',
    paymentFailedStatus: '付款失败',
    refunded: '已退款',
    dataUnavailable: '共享演示数据暂时不可用。',
    london: '伦敦当地时间',
  },
} as const;

function getVenue(venueId: string): Venue {
  return venues.find((venue) => venue.id === venueId) ?? venues[0];
}

function validFormats(value: unknown): GameFormat[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((format): format is GameFormat => GAME_FORMATS.includes(format as GameFormat)))];
}

function normalizeFormats(value: unknown): GameFormat[] {
  const formats = validFormats(value);
  return formats.length ? formats : [...GAME_FORMATS];
}

function formatNames(
  formats: GameFormat[],
  labels: { singles: string; doubles: string },
) {
  return formats.map((format) => labels[format]).join(' · ');
}

function normalizeSession(session: Session): Session {
  return { ...session, formats: normalizeFormats((session as Session & { formats?: unknown }).formats) };
}

function normalizeBooking(booking: Booking): Booking {
  const format = (booking as Booking & { format?: unknown }).format;
  return {
    ...booking,
    format: GAME_FORMATS.includes(format as GameFormat) ? format as GameFormat : 'singles',
  };
}

function bookingStatusLabel(
  status: BookingStatus,
  labels: Record<'bookingConfirmed' | 'pendingPayment' | 'expired' | 'paymentFailedStatus' | 'refunded' | 'cancelled', string>,
) {
  switch (status) {
    case 'confirmed': return labels.bookingConfirmed;
    case 'pending_payment': return labels.pendingPayment;
    case 'expired': return labels.expired;
    case 'payment_failed': return labels.paymentFailedStatus;
    case 'refunded': return labels.refunded;
    case 'cancelled': return labels.cancelled;
  }
}

function formatMoney(pence: number, language: Language) {
  return new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function formatDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(`${date}T12:00:00`));
}

function formatLongDate(date: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(new Date(`${date}T12:00:00`));
}

function parseMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDuration(startTime: string, endTime: string, language: Language) {
  const minutes = Math.max(0, parseMinutes(endTime) - parseMinutes(startTime));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (language === 'zh') {
    return hours ? `${hours}小时${remainder ? ` ${remainder}分钟` : ''}` : `${remainder}分钟`;
  }
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`;
}

function isPast(session: Session) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const londonNow = `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
  return `${session.date}T${session.endTime}:00` <= londonNow;
}

function sessionSort(a: Session, b: Session) {
  return `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`);
}

function emptyDraft(): SessionDraft {
  const defaultDate = createDemoSessions()[6]?.date ?? createDemoSessions()[0]?.date ?? '';
  return {
    id: null,
    venueId: venues[0].id,
    date: defaultDate,
    startTime: '18:30',
    endTime: '20:30',
    price: '10',
    capacity: '8',
    formats: [...GAME_FORMATS],
    description: 'A friendly tennis session for new and returning players.',
    descriptionZh: '适合新朋友和熟悉球友的轻松网球活动。',
    status: 'published',
  };
}

function AppMark() {
  return (
    <span className="app-mark" aria-hidden="true">
      <span />
    </span>
  );
}

function QuantityControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="quantity-control" aria-label={label}>
      <button
        type="button"
        className="quantity-button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={16} strokeWidth={2.5} />
      </button>
      <span className="quantity-value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="quantity-button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function TennisSocialApp({ initialView = 'home' }: { initialView?: View }) {
  const [language, setLanguageValue] = useState<Language>('en');
  const [sessions, setSessions] = useState<Session[]>(seededSessions);
  const [bookings, setBookings] = useState<Booking[]>(seededBookings);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>(initialView);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [bookingStage, setBookingStage] = useState<BookingStage>('details');
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
  const [confirmation, setConfirmation] = useState<Booking | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>('sessions');
  const [draft, setDraft] = useState<SessionDraft>(emptyDraft);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const sessionsRef = useRef(sessions);
  const openSessionRef = useRef<(sessionId: string) => void>(() => undefined);
  const paymentSubmittingRef = useRef(false);
  const cancellingBookingRef = useRef(new Set<string>());

  const t = translations[language];
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedVenue = selectedSession ? getVenue(selectedSession.venueId) : null;
  const activeBookings = bookings.filter((booking) => booking.status === 'confirmed');

  useEffect(() => {
    try {
      const savedSessions = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const savedBookings = window.localStorage.getItem(BOOKING_STORAGE_KEY);
      const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions) as Session[];
        setSessions(parsedSessions.map(normalizeSession));
      }
      if (savedBookings) {
        const parsedBookings = JSON.parse(savedBookings) as Booking[];
        setBookings(parsedBookings.map(normalizeBooking));
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

    const loadSessions = async () => {
      try {
        const response = await fetch('/api/sessions', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { sessions?: Session[] };
        if (!cancelled && data.sessions?.length) setSessions(data.sessions.map(normalizeSession));
      } catch {
        // The seeded read-only demo remains visible if the server is unavailable.
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
              window.history.replaceState({}, '', '/');
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
      if (!bookingId || !checkoutSessionId) return;
      try {
        const response = await fetch(
          `/api/bookings/${encodeURIComponent(bookingId)}?checkout_session_id=${encodeURIComponent(checkoutSessionId)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) throw new Error('booking_unavailable');
        const data = await response.json() as { booking?: Booking };
        if (!cancelled && data.booking?.status === 'confirmed') {
          setSelectedSessionId(data.booking.sessionId);
          setConfirmation(normalizeBooking(data.booking));
          setView('confirmation');
          window.sessionStorage.removeItem('tennis-social-checkout-draft-v1');
          window.history.replaceState({}, '', '/');
          window.scrollTo({ top: 0 });
        }
      } catch {
        if (!cancelled) setPaymentFailed(true);
      }
    };

    void loadSessions();
    void reconcileCheckout();
    return () => { cancelled = true; };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || view !== 'admin') return;
    let cancelled = false;
    const loadAdminBookings = async () => {
      try {
        const response = await fetch('/api/admin/bookings', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { bookings?: Booking[] };
        if (!cancelled && data.bookings) setBookings(data.bookings.map(normalizeBooking));
      } catch {
        // The browser cache remains available for local previews without a database.
      }
    };
    void loadAdminBookings();
    return () => { cancelled = true; };
  }, [hydrated, view]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(bookings));
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [bookings, hydrated, language, sessions]);

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
  const totalPence = selectedSession
    ? selectedSession.pricePence * bookingForm.participants.length +
      bookingForm.racketCount * RACKET_PRICE_PENCE
    : 0;

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigate(nextView: View) {
    if (typeof window !== 'undefined' && (view === 'admin' || nextView === 'admin')) {
      const nextPath = nextView === 'admin' ? '/admin' : '/';
      const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
      if (currentPath !== nextPath) window.history.pushState({}, '', nextPath);
    }
    setView(nextView);
    scrollTop();
  }

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      setView(path === '/admin' ? 'admin' : 'home');
      setSelectedSessionId(null);
      setConfirmation(null);
      setBookingStage('details');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function openSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setFormErrors({});
    setPaymentFailed(false);
    setPaymentCancelled(false);
    navigate('detail');
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
                  const venue = getVenue(session.venueId);
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
  }, []);

  function beginBooking() {
    if (!selectedSession || selectedSession.status !== 'published') return;
    if (selectedSession.capacity - selectedSession.bookedSpots < 1) return;
    setBookingForm({
      name: '',
      email: '',
      phone: '',
      participants: [''],
      format: selectedSession.formats[0] ?? GAME_FORMATS[0],
      racketCount: 0,
      includeFriends: false,
    });
    setBookingStage('details');
    setFormErrors({});
    setPaymentFailed(false);
    setPaymentCancelled(false);
    setAdjustmentNotice('');
    paymentSubmittingRef.current = false;
    navigate('booking');
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
          racketCount: bookingForm.racketCount,
        }),
      });
      const data = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) {
        if (response.status === 409) {
          setBookingStage('details');
          setFormErrors(data.error === 'format_unavailable' ? { format: t.chooseFormat } : { participants: t.notEnoughSpots });
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

  async function resetDemo() {
    if (!window.confirm(t.resetConfirm)) return;
    setAdminBusy(true);
    let resetFromServer = false;
    try {
      const response = await fetch('/api/admin/reset', { method: 'POST' });
      if (response.ok) {
        const data = await response.json() as { sessions?: Session[]; bookings?: Booking[] };
        if (data.sessions && data.bookings) {
          setSessions(data.sessions);
          setBookings(data.bookings);
          resetFromServer = true;
        }
      }
    } catch {
      // Fall back to a browser-only reset for local previews without Postgres.
    }
    if (!resetFromServer) {
      const nextSessions = createDemoSessions() as Session[];
      setSessions(nextSessions);
      setBookings(createDemoBookings(nextSessions) as Booking[]);
    }
    setConfirmation(null);
    setSelectedSessionId(null);
    setDraft(emptyDraft());
    setAdminMessage(t.resetDone);
    paymentSubmittingRef.current = false;
    cancellingBookingRef.current.clear();
    setAdminBusy(false);
    navigate('admin');
  }

  function startEdit(session: Session) {
    setDraft({
      id: session.id,
      venueId: session.venueId,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      price: String(session.pricePence / 100),
      capacity: String(session.capacity),
      formats: normalizeFormats(session.formats),
      description: session.description,
      descriptionZh: session.descriptionZh,
      status: session.status,
    });
    setAdminMessage('');
    scrollTop();
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
      status: draft.status,
      description: draft.description.trim(),
      descriptionZh: draft.descriptionZh.trim(),
    };
    const payload = {
      venueId: nextSession.venueId,
      date: nextSession.date,
      startTime: nextSession.startTime,
      endTime: nextSession.endTime,
      pricePence: nextSession.pricePence,
      capacity: nextSession.capacity,
      formats: nextSession.formats,
      description: nextSession.description,
      descriptionZh: nextSession.descriptionZh,
      status: nextSession.status,
    };
    setAdminBusy(true);
    let savedOnServer = false;
    let useLocalFallback = false;
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
      } else if (data.error === 'locked_fields') {
        setAdminMessage(t.lockedFields);
      } else if (data.error === 'capacity_too_low') {
        setAdminMessage(t.cannotReduceCapacity);
      } else if (response.status < 500) {
        setAdminMessage(t.saveFailed);
      } else {
        useLocalFallback = true;
      }
    } catch {
      // Fall back to local editing when the shared database is not configured.
      useLocalFallback = true;
    }
    if (!savedOnServer && useLocalFallback) {
      setSessions((current) => existing
        ? current.map((session) => (session.id === existing.id ? nextSession : session))
        : [...current, nextSession]);
      setAdminMessage(t.sessionSaved);
    } else if (savedOnServer) {
      setAdminMessage(t.sessionSaved);
    }
    if (savedOnServer || useLocalFallback) setDraft(emptyDraft());
    setAdminBusy(false);
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
    setAdminBusy(true);
    let cancelledOnServer = false;
    let useLocalFallback = false;
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (response.ok) cancelledOnServer = true;
      else if (response.status >= 500) useLocalFallback = true;
    } catch {
      // Fall back to local cancellation for local previews without Postgres.
      useLocalFallback = true;
    }
    if (cancelledOnServer || useLocalFallback) {
      setBookings((current) => current.map((item) => (item.id === bookingId ? { ...item, status: 'cancelled' } : item)));
      setSessions((current) => current.map((session) => session.id === booking.sessionId
        ? { ...session, bookedSpots: Math.max(0, session.bookedSpots - booking.participants.length) }
        : session));
    }
    setAdminBusy(false);
  }

  function setLanguage(nextLanguage: Language) {
    setLanguageValue(nextLanguage);
  }

  const header = (
    <header className="site-header">
      <div className="site-header-inner">
        <button type="button" className="brand-lockup" onClick={() => navigate('home')}>
          <AppMark />
          <span>
            <strong>Tennis Social</strong>
            <small>{t.brandTag}</small>
          </span>
        </button>
        <nav className="site-nav" aria-label="Primary navigation">
          <button type="button" className={view === 'home' ? 'active' : ''} onClick={() => navigate('home')}>
            {t.sessions}
          </button>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="language-switch"
            aria-label="Switch language"
            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
          >
            <Globe2 size={16} />
            <span>{language === 'en' ? '中文' : 'EN'}</span>
          </button>
          <Button className="header-cta" onClick={() => navigate('home')}>
            {t.bookNow}
            <ArrowRight size={15} />
          </Button>
        </div>
      </div>
    </header>
  );

  function sessionCard(session: Session) {
    const venue = getVenue(session.venueId);
    const spots = Math.max(0, session.capacity - session.bookedSpots);
    const isFull = spots === 0;
    return (
      <article className="session-card" key={session.id}>
        <button type="button" className="session-card-image" onClick={() => openSession(session.id)}>
          <img src={venue.photo} alt={`${venue.name} tennis court`} />
          <span className="image-overlay" />
          <span className="date-pill">
            <strong>{new Date(`${session.date}T12:00:00`).getDate()}</strong>
            <small>{new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { month: 'short' }).format(new Date(`${session.date}T12:00:00`))}</small>
          </span>
          {isFull ? <span className="full-pill">{t.full}</span> : null}
        </button>
        <div className="session-card-body">
          <div className="session-card-heading">
            <div>
              <p className="eyebrow muted">{language === 'zh' ? venue.areaZh : venue.area}</p>
              <h3>{language === 'zh' ? venue.nameZh : venue.name}</h3>
            </div>
            <span className="session-price">{formatMoney(session.pricePence, language)}<small>/ {language === 'zh' ? '人' : 'person'}</small></span>
          </div>
          <div className="session-meta-row">
            <span><CalendarDays size={15} /> {formatDate(session.date, language)}</span>
            <span><Clock3 size={15} /> {session.startTime}–{session.endTime}</span>
          </div>
          <div className="session-format-tags" aria-label={t.formats}>
            {session.formats.map((format) => <span key={format}>{formatNames([format], t)}</span>)}
          </div>
          <div className="session-card-footer">
            <span className={isFull ? 'spots full' : spots === 1 ? 'spots urgent' : 'spots'}>
              <Users size={15} /> {isFull ? t.full : `${spots} ${spots === 1 ? t.spotLeft : t.spotsLeft}`}
            </span>
            <Button variant={isFull ? 'outline' : 'default'} disabled={isFull} onClick={() => openSession(session.id)}>
              {isFull ? t.viewDetails : t.bookNow}
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </article>
    );
  }

  function renderHome() {
    return (
      <>
        <section className="home-intro page-width">
          <div className="intro-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> {t.eyebrow}</p>
            <h1>{t.headline}</h1>
            <p className="intro-text">{t.intro}</p>
            <div className="intro-tags">
              <span><Check size={15} /> {t.allLevels}</span>
              <span><Check size={15} /> {t.noSignUp}</span>
              <span><Check size={15} /> {t.courtReady}</span>
            </div>
          </div>
          <div className="intro-photo-grid" aria-label="London tennis courts">
            <img className="intro-photo-large" src="/venues/victoria-park.jpg" alt="Victoria Park tennis court" />
            <img className="intro-photo-small top" src="/venues/bethnal-green.jpg" alt="Bethnal Green tennis court" />
            <img className="intro-photo-small bottom" src="/venues/vauxhall-park.jpg" alt="Vauxhall Park tennis court" />
            <span className="intro-sticker">PLAY<br /><i>more</i></span>
          </div>
        </section>
        <section className="sessions-section page-width" id="sessions">
          <div className="section-heading">
            <div>
              <p className="eyebrow muted">{t.london}</p>
              <h2>{t.upcoming}</h2>
              <p>{t.upcomingIntro}</p>
            </div>
            <span className="session-count">{upcomingSessions.length} {language === 'zh' ? '场可报名' : 'sessions available'}</span>
          </div>
          <div className="session-grid">
            {upcomingSessions.length ? upcomingSessions.map(sessionCard) : <div className="empty-state">{t.emptyBookings}</div>}
          </div>
        </section>
      </>
    );
  }

  function renderDetail() {
    if (!selectedSession || !selectedVenue) return renderHome();
    const spots = Math.max(0, selectedSession.capacity - selectedSession.bookedSpots);
    const full = spots === 0;
    return (
      <section className="detail-page page-width">
        <button type="button" className="back-link" onClick={() => navigate('home')}><ArrowLeft size={16} /> {t.back}</button>
        <div className="detail-layout">
          <div className="detail-visual">
            <img src={selectedVenue.photo} alt={`${selectedVenue.name} tennis court`} />
            <div className="detail-image-caption"><MapPin size={16} /> {language === 'zh' ? selectedVenue.nameZh : selectedVenue.name} · {language === 'zh' ? selectedVenue.areaZh : selectedVenue.area}</div>
          </div>
          <div className="detail-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> {t.sessionDetails}</p>
            <h1>{language === 'zh' ? selectedVenue.nameZh : selectedVenue.name}</h1>
            <p className="detail-description">{language === 'zh' ? selectedSession.descriptionZh : selectedSession.description}</p>
            <div className="detail-facts">
              <div><CalendarDays size={19} /><span><small>{t.date}</small><strong>{formatLongDate(selectedSession.date, language)}</strong></span></div>
              <div><Clock3 size={19} /><span><small>{t.time}</small><strong>{selectedSession.startTime}–{selectedSession.endTime} · {t.london}</strong></span></div>
              <div><Timer size={19} /><span><small>{t.duration}</small><strong>{formatDuration(selectedSession.startTime, selectedSession.endTime, language)}</strong></span></div>
              <div><CircleDot size={19} /><span><small>{t.formats}</small><strong>{formatNames(selectedSession.formats, t)}</strong></span></div>
              <div><Users size={19} /><span><small>{t.availability}</small><strong>{full ? t.full : `${spots} ${spots === 1 ? t.spotLeft : t.spotsLeft}`}</strong></span></div>
              <div><CreditCard size={19} /><span><small>{t.pricePerPerson}</small><strong>{formatMoney(selectedSession.pricePence, language)}</strong></span></div>
            </div>
            <div className="detail-note"><ShieldCheck size={18} /><span>{t.noLevelLimit}. {t.allLevels}.</span></div>
            <Button size="lg" className="primary-wide" disabled={full} onClick={beginBooking}>
              {full ? t.full : t.bookNow}<ArrowRight size={17} />
            </Button>
          </div>
        </div>
        <div className="detail-about">
          <div><p className="eyebrow muted">{t.aboutSession}</p><h2>{language === 'zh' ? '认识球友，把时间留给球场。' : 'Meet a few players. Make time for the court.'}</h2></div>
          <p>{language === 'zh' ? selectedSession.descriptionZh : selectedSession.description}</p>
        </div>
      </section>
    );
  }

  function renderProgress() {
    return (
      <div className="booking-progress" aria-label="Booking progress">
        <span className={bookingStage === 'details' ? 'current' : 'done'}><b>{bookingStage === 'details' ? '1' : <Check size={13} />}</b>{t.contactDetails}</span>
        <i />
        <span className={bookingStage === 'payment' ? 'current' : ''}><b>2</b>{t.payment}</span>
      </div>
    );
  }

  function renderSummary() {
    if (!selectedSession || !selectedVenue) return null;
    return (
      <aside className="order-summary">
        <div className="summary-image"><img src={selectedVenue.photo} alt="" /></div>
        <div className="summary-content">
          <p className="eyebrow muted">{t.orderSummary}</p>
          <h3>{language === 'zh' ? selectedVenue.nameZh : selectedVenue.name}</h3>
          <p className="summary-date"><CalendarDays size={15} /> {formatDate(selectedSession.date, language)} · {selectedSession.startTime}–{selectedSession.endTime}</p>
          <p className="summary-format"><CircleDot size={15} /> {t.format}: {bookingForm.format ? formatNames([bookingForm.format], t) : ''}</p>
          <div className="summary-lines">
            <div><span>{t.sessionFee} × {bookingForm.participants.length}</span><strong>{formatMoney(selectedSession.pricePence * bookingForm.participants.length, language)}</strong></div>
            <div><span>{t.racketFee} × {bookingForm.racketCount}</span><strong>{formatMoney(bookingForm.racketCount * RACKET_PRICE_PENCE, language)}</strong></div>
          </div>
          <div className="summary-total"><span>{t.total}</span><strong>{formatMoney(totalPence, language)}</strong></div>
          <p className="summary-notice"><ShieldCheck size={15} /> {t.demoNotice}</p>
        </div>
      </aside>
    );
  }

  function renderBooking() {
    if (!selectedSession || !selectedVenue) return renderHome();
    if (bookingStage === 'payment') {
      return (
        <section className="booking-page page-width">
          <button type="button" className="back-link" onClick={() => setBookingStage('details')}><ArrowLeft size={16} /> {t.contactDetails}</button>
          {renderProgress()}
          <div className="booking-layout payment-layout">
            <div className="payment-panel">
              <p className="eyebrow"><span className="eyebrow-dot" /> {t.payment}</p>
              <h1>{t.demoPayment}</h1>
              <p className="form-intro">{t.paymentIntro}</p>
              <div className="demo-payment-card">
                <div className="demo-card-icon"><CreditCard size={24} /></div>
                <div><strong>{t.demoPayment}</strong><span>{t.demoPaymentIntro}</span></div>
                <Badge variant="secondary">STRIPE</Badge>
              </div>
              {paymentFailed || paymentCancelled ? <div className="inline-error"><TriangleAlert size={16} /> {paymentCancelled ? t.paymentCancelled : t.paymentFailed}</div> : null}
              <div className="payment-actions">
                <Button size="lg" className="primary-wide" disabled={checkoutLoading} onClick={() => void completePayment()}>{checkoutLoading ? (language === 'zh' ? '正在打开安全付款…' : 'Opening secure checkout…') : t.simulateSuccess}<ArrowRight size={17} /></Button>
              </div>
            </div>
            {renderSummary()}
          </div>
        </section>
      );
    }
    return (
      <section className="booking-page page-width">
        <button type="button" className="back-link" onClick={() => navigate('detail')}><ArrowLeft size={16} /> {t.back}</button>
        {renderProgress()}
        <div className="booking-layout">
          <form className="booking-form" onSubmit={continueToPayment} noValidate>
            <p className="eyebrow"><span className="eyebrow-dot" /> {t.bookYourPlace}</p>
            <h1>{t.contactDetails}</h1>
            <p className="form-intro">{t.contactIntro}</p>
            <div className="form-grid two-col">
              <div className="field"><Label htmlFor="name">{t.name} <em>*</em></Label><Input id="name" value={bookingForm.name} onChange={(event) => setBookingForm((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></div>
              <div className="field"><Label htmlFor="email">{t.email} <em>*</em></Label><Input id="email" inputMode="email" value={bookingForm.email} onChange={(event) => setBookingForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></div>
            </div>
            <div className="field"><Label htmlFor="phone">{t.phone} <small>({t.optional})</small></Label><Input id="phone" inputMode="tel" value={bookingForm.phone} onChange={(event) => setBookingForm((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" /></div>
            {formErrors.contact || formErrors.email ? <div className="inline-error"><TriangleAlert size={16} /> {formErrors.contact || formErrors.email}</div> : null}
            <div className="form-divider" />
            <div className="format-selection">
              <div className="form-section-heading"><div><h2>{t.format}</h2><p>{t.availableFormats}</p></div></div>
              <div className="format-options" role="radiogroup" aria-label={t.format}>
                {selectedSession.formats.map((format) => (
                  <label className={`format-option${bookingForm.format === format ? ' selected' : ''}`} key={format}>
                    <input
                      type="radio"
                      name="session-format"
                      value={format}
                      checked={bookingForm.format === format}
                      onChange={() => {
                        setBookingForm((current) => ({ ...current, format }));
                        setFormErrors((current) => ({ ...current, format: '' }));
                      }}
                    />
                    <span>{formatNames([format], t)}</span>
                  </label>
                ))}
              </div>
            </div>
            {formErrors.format ? <div className="inline-error"><TriangleAlert size={16} /> {formErrors.format}</div> : null}
            <div className="form-divider" />
            <div className="form-section-heading">
              <div><h2>{t.participants}</h2><p>{t.allLevels}</p></div>
              <div className="participant-controls">
                <label className="friends-toggle">
                  <input
                    type="checkbox"
                    checked={bookingForm.includeFriends}
                    disabled={selectedSession.capacity - selectedSession.bookedSpots < 2}
                    onChange={(event) => toggleFriends(event.target.checked)}
                  />
                  <span>{t.addFriends}</span>
                </label>
                {bookingForm.includeFriends ? <QuantityControl label={t.groupSize} value={bookingForm.participants.length} min={1} max={selectedSession.capacity - selectedSession.bookedSpots} onChange={updateGroupSize} /> : <span className="single-person-count">1 {t.person}</span>}
              </div>
            </div>
            <div className="level-list">
              {bookingForm.participants.map((level, index) => (
                <div className="field" key={`${index}-${bookingForm.participants.length}`}><Label htmlFor={`level-${index}`}>{index === 0 ? t.yourLevel : `${t.friendLevel} ${index}` } <em>*</em></Label><select id={`level-${index}`} value={level} onChange={(event) => updateParticipant(index, event.target.value)} className="native-select"><option value="">{language === 'zh' ? '请选择水平' : 'Select level'}</option>{LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
              ))}
            </div>
            {adjustmentNotice ? <p className="adjustment-notice"><TriangleAlert size={15} /> {adjustmentNotice}</p> : null}
            {formErrors.participants ? <div className="inline-error"><TriangleAlert size={16} /> {formErrors.participants}</div> : null}
            <div className="form-divider" />
            <div className="form-section-heading"><div><h2>{t.rental}</h2><p>{t.rentalIntro}</p></div><QuantityControl label={t.rental} value={bookingForm.racketCount} min={0} max={bookingForm.participants.length} onChange={(value) => { setBookingForm((current) => ({ ...current, racketCount: value })); setAdjustmentNotice(''); }} /></div>
            <div className="rental-hint"><span>{bookingForm.racketCount} {bookingForm.racketCount === 1 ? t.racket : t.rackets}</span><span>{formatMoney(bookingForm.racketCount * RACKET_PRICE_PENCE, language)}</span></div>
            <Button size="lg" className="primary-wide form-submit" type="submit">{t.continuePayment}<ArrowRight size={17} /></Button>
          </form>
          {renderSummary()}
        </div>
      </section>
    );
  }

  function renderConfirmation() {
    if (!confirmation) return renderHome();
    const session = sessions.find((item) => item.id === confirmation.sessionId);
    if (!session) return renderHome();
    const venue = getVenue(session.venueId);
    return (
      <section className="confirmation-page page-width">
        <div className="confirmation-card">
          <div className="success-icon"><Check size={28} strokeWidth={3} /></div>
          <p className="eyebrow"><span className="eyebrow-dot" /> {t.confirmed}</p>
          <h1>{t.confirmed}</h1>
          <p className="confirmation-intro">{t.confirmationIntro}</p>
          <div className="reference-box"><span>{t.bookingReference}</span><strong>{confirmation.id}</strong></div>
          <div className="confirmation-details">
            <div><img src={venue.photo} alt="" /><span><small>{t.location}</small><strong>{language === 'zh' ? venue.nameZh : venue.name}</strong></span></div>
            <div><CalendarDays size={18} /><span><small>{t.date}</small><strong>{formatLongDate(session.date, language)}</strong></span></div>
            <div><CircleDot size={18} /><span><small>{t.format}</small><strong>{formatNames([confirmation.format], t)}</strong></span></div>
            <div><Users size={18} /><span><small>{t.participants}</small><strong>{confirmation.participants.length} {confirmation.participants.length === 1 ? t.person : t.people}</strong></span></div>
            <div><CreditCard size={18} /><span><small>{t.rental}</small><strong>{confirmation.racketCount} {confirmation.racketCount === 1 ? t.racket : t.rackets}</strong></span></div>
            <div><CreditCard size={18} /><span><small>{t.total}</small><strong>{formatMoney(confirmation.totalPence, language)}</strong></span></div>
          </div>
          <div className="participant-chips">{confirmation.participants.map((level, index) => <span key={`${level}-${index}`}>{index === 0 ? t.name : `${t.friendLevel} ${index}`} · {level}</span>)}</div>
          <div className="confirmation-fee-breakdown" aria-label={t.orderSummary}>
            <div><span>{t.sessionFee} × {confirmation.participants.length}</span><strong>{formatMoney(session.pricePence * confirmation.participants.length, language)}</strong></div>
            <div><span>{t.racketFee} × {confirmation.racketCount}</span><strong>{formatMoney(confirmation.racketCount * RACKET_PRICE_PENCE, language)}</strong></div>
            <div><span>{t.total}</span><strong>{formatMoney(confirmation.totalPence, language)}</strong></div>
          </div>
          <p className="confirmation-notice"><ShieldCheck size={15} /> {t.demoNotice}</p>
          <Button size="lg" className="primary-wide" onClick={() => navigate('home')}>{t.browseMore}<ArrowRight size={17} /></Button>
        </div>
      </section>
    );
  }

  function renderSessionEditor() {
    const hasActiveBookings = draft.id
      ? bookings.some((booking) => booking.sessionId === draft.id && booking.status === 'confirmed')
      : false;
    return (
      <form className="admin-editor" onSubmit={saveDraft}>
        <div className="admin-editor-heading"><div><p className="eyebrow muted">{draft.id ? t.editSession : t.addSession}</p><h2>{draft.id ? t.editSession : t.addSession}</h2></div>{draft.id ? <button type="button" className="text-button" onClick={() => setDraft(emptyDraft())}>{t.cancelEdit}</button> : null}</div>
        <div className="form-grid two-col">
          <div className="field"><Label htmlFor="admin-venue">{t.location}</Label><select id="admin-venue" value={draft.venueId} onChange={(event) => setDraft((current) => ({ ...current, venueId: event.target.value }))} className="native-select" disabled={hasActiveBookings}>{venues.map((venue) => <option key={venue.id} value={venue.id}>{language === 'zh' ? venue.nameZh : venue.name}</option>)}</select></div>
          <div className="field"><Label htmlFor="admin-date">{t.date}</Label><Input id="admin-date" type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} disabled={hasActiveBookings} /></div>
          <div className="field"><Label htmlFor="admin-start">{t.time}</Label><div className="time-pair"><Input id="admin-start" type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} disabled={hasActiveBookings} /><span>–</span><Input id="admin-end" type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} disabled={hasActiveBookings} /></div></div>
          <div className="field"><Label htmlFor="admin-price">{t.pricePerPerson}</Label><div className="input-prefix"><span>£</span><Input id="admin-price" inputMode="decimal" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} disabled={hasActiveBookings} /></div></div>
          <div className="field"><Label htmlFor="admin-capacity">{t.capacity}</Label><Input id="admin-capacity" type="number" min="1" value={draft.capacity} onChange={(event) => setDraft((current) => ({ ...current, capacity: event.target.value }))} /></div>
          <div className="field"><Label htmlFor="admin-status">{t.status}</Label><select id="admin-status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as SessionStatus }))} className="native-select"><option value="published">{t.published}</option><option value="draft">{t.draft}</option></select></div>
          <div className="field admin-format-field"><span className="field-label">{t.formats}</span><fieldset className="format-checkboxes"><legend className="sr-only">{t.formats}</legend>{GAME_FORMATS.map((format) => <label className="format-checkbox" key={format}><input type="checkbox" checked={draft.formats.includes(format)} onChange={(event) => setDraft((current) => ({ ...current, formats: event.target.checked ? [...new Set([...current.formats, format])] : current.formats.filter((item) => item !== format) }))} /><span>{formatNames([format], t)}</span></label>)}</fieldset></div>
        </div>
        {hasActiveBookings ? <p className="admin-field-note"><ShieldCheck size={15} /> {t.lockedFields}</p> : null}
        <div className="form-grid two-col"><div className="field"><Label htmlFor="admin-description">English description</Label><textarea id="admin-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="native-textarea" rows={3} /></div><div className="field"><Label htmlFor="admin-description-zh">中文介绍</Label><textarea id="admin-description-zh" value={draft.descriptionZh} onChange={(event) => setDraft((current) => ({ ...current, descriptionZh: event.target.value }))} className="native-textarea" rows={3} /></div></div>
        {adminMessage ? <div className="admin-message"><Check size={15} /> {adminMessage}</div> : null}
        <Button type="submit" disabled={adminBusy}><Check size={16} /> {adminBusy ? t.saving : t.saveSession}</Button>
      </form>
    );
  }

  function renderAdmin() {
    const publishedCount = sessions.filter((session) => session.status === 'published').length;
    const openSpots = sessions.reduce(
      (sum, session) => sum + Math.max(0, session.capacity - session.bookedSpots),
      0,
    );
    return (
      <section className="admin-page page-width">
        <div className="admin-heading">
          <div>
            <p className="eyebrow"><Settings2 size={14} /> {t.admin}</p>
            <h1>{t.adminTitle}</h1>
            <p>{t.adminIntro}</p>
          </div>
          <Button variant="outline" onClick={() => void resetDemo()} disabled={adminBusy}>
            <RefreshCw size={15} /> {t.resetDemo}
          </Button>
        </div>
        <div className="admin-stats">
          <div><span>{publishedCount}</span><small>{t.published}</small></div>
          <div><span>{activeBookings.length}</span><small>{t.activeBookings}</small></div>
          <div><span>{openSpots}</span><small>{t.spotsLeft}</small></div>
        </div>
        <div className="admin-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={adminTab === 'sessions'} className={adminTab === 'sessions' ? 'active' : ''} onClick={() => setAdminTab('sessions')}>
            {t.manageSessions}
          </button>
          <button type="button" role="tab" aria-selected={adminTab === 'bookings'} className={adminTab === 'bookings' ? 'active' : ''} onClick={() => setAdminTab('bookings')}>
            {t.viewBookings}
          </button>
        </div>
        {adminTab === 'sessions' ? (
          <div className="admin-session-layout">
            <div className="admin-session-list">
              <div className="admin-list-heading">
                <div><p className="eyebrow muted">{t.sessions}</p><h2>{t.upcoming}</h2></div>
                <Badge variant="secondary">{allSessions.length}</Badge>
              </div>
              {allSessions.map((session) => {
                const venue = getVenue(session.venueId);
                const spots = Math.max(0, session.capacity - session.bookedSpots);
                return (
                  <div className="admin-session-row" key={session.id}>
                    <img src={venue.photo} alt="" />
                    <div className="admin-session-row-main">
                      <div>
                        <strong>{language === 'zh' ? venue.nameZh : venue.name}</strong>
                        <Badge variant={session.status === 'published' ? 'default' : 'outline'}>{session.status === 'published' ? t.published : t.draft}</Badge>
                      </div>
                      <span>{formatDate(session.date, language)} · {session.startTime}–{session.endTime}</span>
                      <small>{formatNames(session.formats, t)} · {session.bookedSpots}/{session.capacity} {t.booked} · {spots} {t.spotsLeft}</small>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => startEdit(session)} disabled={adminBusy}>
                      <Pencil size={14} /> {t.edit}
                    </Button>
                  </div>
                );
              })}
            </div>
            {renderSessionEditor()}
          </div>
        ) : (
          <div className="admin-bookings">
            <div className="admin-list-heading">
              <div><p className="eyebrow muted">{t.admin}</p><h2>{t.bookingList}</h2><p>{t.bookingListIntro}</p></div>
              <Badge variant="secondary">{bookings.length}</Badge>
            </div>
            {bookings.length ? (
              <div className="booking-table-wrap">
                <table className="booking-table">
                  <thead><tr><th>{t.contact}</th><th>{t.sessions}</th><th>{t.format}</th><th>{t.participants}</th><th>{t.total}</th><th>{t.status}</th><th scope="col">{t.actions}</th></tr></thead>
                  <tbody>
                    {bookings.map((booking) => {
                      const session = sessions.find((item) => item.id === booking.sessionId);
                      const venue = session ? getVenue(session.venueId) : venues[0];
                      return (
                        <tr key={booking.id}>
                          <td><strong>{booking.contactName}</strong><span>{booking.email}</span>{booking.phone ? <span>{booking.phone}</span> : null}</td>
                          <td><strong>{language === 'zh' ? venue.nameZh : venue.name}</strong><span>{session ? formatDate(session.date, language) : ''}</span></td>
                          <td><strong>{formatNames([booking.format], t)}</strong></td>
                          <td><strong>{booking.participants.length} {booking.participants.length === 1 ? t.person : t.people}</strong><span>{booking.participants.join(' · ')}</span></td>
                          <td>{formatMoney(booking.totalPence, language)}</td>
                          <td><Badge variant={booking.status === 'confirmed' ? 'default' : 'outline'}>{bookingStatusLabel(booking.status, t)}</Badge></td>
                          <td>{booking.status === 'confirmed' ? <Button variant="ghost" size="sm" onClick={() => void cancelBooking(booking.id)} disabled={adminBusy}>{t.cancelBooking}</Button> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state">{t.emptyBookings}</div>}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="app-shell">
      {header}
      <main>
        {view === 'home' ? renderHome() : null}
        {view === 'detail' ? renderDetail() : null}
        {view === 'booking' ? renderBooking() : null}
        {view === 'confirmation' ? renderConfirmation() : null}
        {view === 'admin' ? renderAdmin() : null}
      </main>
      <footer className="site-footer page-width"><span><AppMark /> Tennis Social</span><small>{t.demoNotice}</small></footer>
    </div>
  );
}

export default function Home() {
  return <TennisSocialApp />;
}
