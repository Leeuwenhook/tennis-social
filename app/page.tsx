'use client';

import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.mjs';
import CalendarPlus from 'lucide-react/dist/esm/icons/calendar-plus.mjs';
import Check from 'lucide-react/dist/esm/icons/check.mjs';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.mjs';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.mjs';
import CircleDot from 'lucide-react/dist/esm/icons/circle-dot.mjs';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.mjs';
import Download from 'lucide-react/dist/esm/icons/download.mjs';
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
import Upload from 'lucide-react/dist/esm/icons/upload.mjs';
import UserRound from 'lucide-react/dist/esm/icons/user-round.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseSessionWorkbook, SessionImportError } from '@/lib/session-import';
import {
  createDemoBookings,
  createDemoSessions,
  DEFAULT_OFF_PEAK_PRICE_PENCE,
  DEFAULT_PEAK_PRICE_PENCE,
  GAME_FORMATS,
  PREFERRED_FORMATS,
  RACKET_PRICE_PENCE,
  venues,
  type GameFormat,
  type PreferredFormat,
  type Venue,
} from '@/lib/demo-data';

type Language = 'en' | 'zh';
type View = 'home' | 'detail' | 'booking' | 'confirmation' | 'account' | 'request' | 'admin';
type BookingStage = 'details' | 'payment';
type AuthMode = 'login' | 'register';
type AdminTab = 'sessions' | 'bookings' | 'requests' | 'venues';
type SessionStatus = 'published' | 'draft';
type BookingStatus = 'pending_payment' | 'confirmed' | 'expired' | 'payment_failed' | 'cancelled' | 'refunded';
type ConfirmationEmailStatus = 'sent' | 'skipped' | 'in_progress' | 'failed' | 'not_applicable';

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
  couponId?: string | null;
  couponDiscountPence?: number;
  totalPence: number;
  status: BookingStatus;
  createdAt: string;
};

type CouponStatus = 'available' | 'reserved' | 'redeemed' | 'expired';
type Coupon = {
  id: string;
  code: string;
  discountPercent: number;
  milestoneCount: number;
  issuedAt: string;
  expiresAt: string;
  status: CouponStatus;
  redeemedAt: string | null;
};
type LoyaltyStatus = {
  participationCount: number;
  nextRewardAt: number;
  coupons: Coupon[];
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

type VenueDraft = {
  id: string | null;
  name: string;
  nameZh: string;
  area: string;
  areaZh: string;
  photo: string;
  peakPrice: string;
  offPeakPrice: string;
};

type ReservationRequestStatus = 'pending' | 'reviewing' | 'completed';
type ReservationRequest = {
  id: string;
  venueId: string | null;
  venueName: string;
  preferredDate: string;
  startTime: string;
  endTime: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
  status: ReservationRequestStatus;
  createdAt: string;
};
type ReservationRequestForm = {
  venueId: string | null;
  venueName: string;
  preferredDate: string;
  startTime: string;
  endTime: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
};

type PreferredTime = 'weekends' | 'weekday_evenings' | 'anytime' | 'mornings' | 'afternoons';
type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  tennisLevel: string;
  preferredTime: PreferredTime;
  preferredFormat: PreferredFormat;
};
type ProfileForm = Omit<UserProfile, 'id'>;

const LEVELS = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];
const PREFERRED_TIMES: PreferredTime[] = ['weekends', 'weekday_evenings', 'anytime', 'mornings', 'afternoons'];
const SESSION_STORAGE_KEY = 'tennis-social-sessions-v2';
const BOOKING_STORAGE_KEY = 'tennis-social-bookings-v2';
const VENUE_STORAGE_KEY = 'tennis-social-venues-v1';
const LANGUAGE_STORAGE_KEY = 'tennis-social-language-v1';

const seededSessions: Session[] = createDemoSessions();

const seededBookings: Booking[] = createDemoBookings(seededSessions);

const translations = {
  en: {
    sessions: 'Sessions',
    admin: 'Admin',
    brandTag: 'London tennis community',
    eyebrow: 'FIND YOUR NEXT COURT',
    headline: 'Good tennis is better together.',
    intro:
      'Friendly, organised tennis sessions across London. Pick a time, meet a few players and get on court.',
    upcoming: 'Upcoming sessions',
    upcomingIntro: 'Choose a time that works for you. Every session is open to all levels.',
    allLevels: 'All levels welcome',
    noSignUp: 'No account required',
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
    both: 'Both',
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
    couponDiscount: 'Half-price voucher',
    applyCoupon: 'Apply a half-price voucher',
    noCoupon: 'No voucher applied',
    couponCode: 'Voucher code',
    couponExpires: 'Expires {date}',
    couponUsed: 'Used',
    couponPending: 'Pending payment',
    couponExpired: 'Expired',
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
    emailConfirmationSent: 'Booking details and a calendar invite were sent to',
    emailConfirmationPending: 'Your booking is confirmed. The confirmation email will be sent shortly.',
    emailConfirmationSkipped: 'Your booking is confirmed, but email delivery is not configured for this preview.',
    emailConfirmationFailed: 'Your booking is confirmed, but the confirmation email could not be sent yet. Please keep this reference.',
    contact: 'Contact',
    participants: 'Participants',
    level: 'level',
    levels: 'levels',
    bookingConfirmed: 'Confirmed',
    actions: 'Actions',
    demoNotice: 'Payment is securely processed by Stripe. We never receive your card details.',
    browseMore: 'Browse more sessions',
    adminTitle: 'Admin dashboard',
    adminIntro: 'Manage sessions, venues, bookings and advance court requests.',
    manageSessions: 'Manage sessions',
    viewBookings: 'View bookings',
    addSession: 'Add session',
    downloadSessionTemplate: 'Download Excel template',
    importSessions: 'Import Excel sessions',
    importingSessions: 'Importing…',
    sessionImportHelp: 'Fill in the template and import up to 200 sessions at a time.',
    sessionImportSuccess: '{count} sessions imported.',
    sessionImportFailed: 'Import failed. Check the workbook and try again.',
    sessionImportInvalidFile: 'Choose a valid .xlsx file up to 5 MB.',
    sessionImportMissingColumns: 'The first worksheet is missing required template columns.',
    sessionImportNoRows: 'The workbook does not contain any session rows.',
    sessionImportTooManyRows: 'Import up to 200 sessions at a time.',
    sessionImportTooLarge: 'This batch is too large. Split it into smaller imports.',
    sessionImportInvalidRows: 'Check these worksheet rows: {rows}.',
    sessionImportDuplicateRows: 'These rows duplicate an existing session or another imported row: {rows}.',
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
    adminLoginTitle: 'Admin sign in',
    adminLoginIntro: 'Sign in to manage sessions, venues, images and prices.',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    account: 'Account',
    createAccount: 'Create account',
    accountTitle: 'Your tennis profile',
    accountIntro: 'Save your details and playing preferences for faster booking.',
    welcomeBack: 'Welcome back',
    loginIntro: 'Sign in to pre-fill your next booking.',
    registerIntro: 'Tell us how and when you like to play. We’ll use it as your booking default.',
    postcode: 'Home postcode',
    preferredTime: 'Preferred playing time',
    preferredFormat: 'Preferred format',
    weekends: 'Weekends',
    weekdayEvenings: 'Weekday evenings',
    anytime: 'Any time',
    mornings: 'Mornings',
    afternoons: 'Afternoons',
    passwordHint: 'At least 8 characters',
    creatingAccount: 'Creating account…',
    emailExists: 'An account already exists for this email.',
    registrationInvalid: 'Please complete the required fields and use a password of at least 8 characters.',
    signedInPrefill: 'Your saved profile has been pre-filled. You can still change it for this booking.',
    memberSince: 'Saved playing preferences',
    loyaltyTitle: 'Member rewards',
    participationCount: 'Confirmed activities',
    nextReward: 'Your next half-price voucher unlocks at {count} activities.',
    rewardProgress: '{count} of {target} activities',
    rewardEarned: 'You earned a half-price voucher. It is valid for three months.',
    noCoupons: 'No vouchers yet. Complete ten confirmed activities to earn one.',
    loyaltyUnavailable: 'Rewards are temporarily unavailable.',
    editProfile: 'Edit profile',
    editProfileIntro: 'Update your saved details and playing preferences.',
    saveProfile: 'Save profile',
    savingProfile: 'Saving profile…',
    profileUpdateFailed: 'We couldn’t update your profile. Please try again.',
    invalidCredentials: 'Incorrect username or password.',
    checkingAccess: 'Checking admin access…',
    logout: 'Sign out',
    manageVenues: 'Manage venues',
    venueList: 'Venue list',
    venueListIntro: 'Update venue details, images and default peak/off-peak prices.',
    addVenue: 'Add venue',
    editVenue: 'Edit venue',
    saveVenue: 'Save venue',
    venueName: 'Venue name',
    venueNameZh: 'Chinese name',
    area: 'Area',
    areaZh: 'Chinese area',
    venueImage: 'Venue image',
    imageUrl: 'Image URL or public path',
    uploadImage: 'Choose image',
    imageHelp: 'Use a public image URL, a path such as /venues/example.jpg, or choose a local image up to 1 MB.',
    peakPrice: 'Peak default price',
    offPeakPrice: 'Off-peak default price',
    usePeakPrice: 'Use peak default',
    useOffPeakPrice: 'Use off-peak default',
    priceRule: 'Peak price must be at least the off-peak price.',
    venueSaved: 'Venue saved.',
    venueSaveFailed: 'Please complete all venue fields and check the prices.',
    imageTooLarge: 'Please choose an image smaller than 1 MB.',
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
    requestCta: "Can't find the session you want? Request a court",
    requestCtaHint: 'Tell us your preferred court and time.',
    requestTitle: 'Request a tennis session',
    requestIntro: 'Leave your preferred court and time. No account is required.',
    requestPromise: 'Requests made at least 7 days ahead are guaranteed. Sessions within 7 days cannot be guaranteed.',
    preferredDate: 'Preferred date',
    preferredTimeRange: 'Preferred time',
    locationPlaceholder: 'Type a venue or area',
    locationHint: 'Type to search venues or enter another location.',
    noLocationMatches: 'No matching venue. Your location will be saved as entered.',
    requestMessage: 'Message',
    requestMessageHint: 'Player count, alternative times, or anything else we should know.',
    submitRequest: 'Submit request',
    submittingRequest: 'Submitting…',
    requestSubmitted: 'Request received',
    requestSubmittedIntro: 'We have saved your court request and will contact you using the details below.',
    requestReference: 'Request reference',
    requestInvalid: 'Please complete the required fields and check the date and time.',
    requestList: 'Court requests',
    requestListIntro: 'Review advance requests and update their progress.',
    manageRequests: 'Court requests',
    noRequests: 'No court requests yet.',
    requestedOn: 'Submitted',
    pendingRequest: 'New',
    reviewingRequest: 'Reviewing',
    completedRequest: 'Completed',
    markReviewing: 'Start review',
    markCompleted: 'Mark completed',
  },
  zh: {
    sessions: '场次',
    admin: '后台管理',
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
    couponDiscount: '半价券优惠',
    applyCoupon: '使用半价券',
    noCoupon: '不使用优惠券',
    couponCode: '优惠券编号',
    couponExpires: '有效期至 {date}',
    couponUsed: '已使用',
    couponPending: '付款中',
    couponExpired: '已过期',
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
    emailConfirmationSent: '订票信息和日程邀请已发送至',
    emailConfirmationPending: '报名已确认，确认邮件很快会发送。',
    emailConfirmationSkipped: '报名已确认，但当前演示环境尚未配置邮件发送。',
    emailConfirmationFailed: '报名已确认，但确认邮件暂时发送失败，请保存这个报名编号。',
    contact: '联系人',
    participants: '参与者',
    level: '水平',
    levels: '水平',
    bookingConfirmed: '已确认',
    actions: '操作',
    demoNotice: '付款由 Stripe 安全处理，我们不会接触你的银行卡信息。',
    browseMore: '浏览更多场次',
    adminTitle: '后台管理',
    adminIntro: '管理场次、场地、报名以及用户的提前预约请求。',
    manageSessions: '管理场次',
    viewBookings: '查看报名',
    addSession: '新增场次',
    downloadSessionTemplate: '下载 Excel 模板',
    importSessions: '导入 Excel 场次',
    importingSessions: '正在导入…',
    sessionImportHelp: '填写模板后导入，每次最多 200 场。',
    sessionImportSuccess: '已导入 {count} 场。',
    sessionImportFailed: '导入失败，请检查工作簿后重试。',
    sessionImportInvalidFile: '请选择有效的 .xlsx 文件，大小不得超过 5 MB。',
    sessionImportMissingColumns: '第一个工作表缺少模板要求的列。',
    sessionImportNoRows: '工作簿中没有场次数据。',
    sessionImportTooManyRows: '每次最多导入 200 场。',
    sessionImportTooLarge: '本批数据过大，请拆分成多个批次导入。',
    sessionImportInvalidRows: '请检查工作表中的这些行：{rows}。',
    sessionImportDuplicateRows: '这些行与已有场次或本次导入中的其他行重复：{rows}。',
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
    adminLoginTitle: '后台登录',
    adminLoginIntro: '登录后管理场次、场地、图片以及默认价格。',
    username: '用户名',
    password: '密码',
    signIn: '登录',
    signingIn: '登录中…',
    account: '账户',
    createAccount: '注册账户',
    accountTitle: '你的网球档案',
    accountIntro: '保存联系方式与打球偏好，下次报名更快捷。',
    welcomeBack: '欢迎回来',
    loginIntro: '登录后，下次报名会自动填写你的资料。',
    registerIntro: '告诉我们你喜欢怎么打、什么时候打，这些信息会成为报名默认值。',
    postcode: '居住地区 Postcode',
    preferredTime: '偏好的打球时间',
    preferredFormat: '偏好的比赛形式',
    both: '都可以',
    weekends: '周末',
    weekdayEvenings: '工作日晚上',
    anytime: '任意时间都可以',
    mornings: '上午',
    afternoons: '下午',
    passwordHint: '至少 8 个字符',
    creatingAccount: '正在注册…',
    emailExists: '该邮箱已经注册，请直接登录。',
    registrationInvalid: '请填写必填项，密码至少需要 8 个字符。',
    signedInPrefill: '已自动填写你保存的资料；本次报名仍可修改。',
    memberSince: '已保存的打球偏好',
    loyaltyTitle: '会员奖励',
    participationCount: '已确认参加活动',
    nextReward: '再参加 {count} 次活动即可获得下一张半价券。',
    rewardProgress: '已完成 {count} / {target} 次活动',
    rewardEarned: '你已获得一张半价券，有效期三个月。',
    noCoupons: '暂时没有优惠券。确认参加满 10 次活动后即可获得。',
    loyaltyUnavailable: '奖励信息暂时无法加载。',
    editProfile: '编辑个人资料',
    editProfileIntro: '更新你保存的联系方式与打球偏好。',
    saveProfile: '保存个人资料',
    savingProfile: '正在保存…',
    profileUpdateFailed: '个人资料更新失败，请重试。',
    invalidCredentials: '用户名或密码不正确。',
    checkingAccess: '正在检查后台权限…',
    logout: '退出登录',
    manageVenues: '管理场地',
    venueList: '场地列表',
    venueListIntro: '更新场地信息、图片以及忙时/闲时默认价格。',
    addVenue: '新增场地',
    editVenue: '编辑场地',
    saveVenue: '保存场地',
    venueName: '场地名称',
    venueNameZh: '中文名称',
    area: '区域',
    areaZh: '中文区域',
    venueImage: '场地图片',
    imageUrl: '图片 URL 或公开路径',
    uploadImage: '选择图片',
    imageHelp: '可填写公开图片 URL、/venues/example.jpg 路径，或选择 1 MB 以内的本地图片。',
    peakPrice: '忙时默认价格',
    offPeakPrice: '闲时默认价格',
    usePeakPrice: '使用忙时默认价',
    useOffPeakPrice: '使用闲时默认价',
    priceRule: '忙时价格应不低于闲时价格。',
    venueSaved: '场地已保存。',
    venueSaveFailed: '请填写完整场地信息，并检查价格。',
    imageTooLarge: '请选择小于 1 MB 的图片。',
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
    requestCta: '没找到想要的场次？点击预约！',
    requestCtaHint: '告诉我们你想要的场地和时间。',
    requestTitle: '预约指定场地和时间',
    requestIntro: '留下你想要的场地和时间，无需注册账号。',
    requestPromise: '提前七天一定能约上，七天内场次不能保证。',
    preferredDate: '预约日期',
    preferredTimeRange: '预约时间',
    locationPlaceholder: '输入场地或区域',
    locationHint: '输入场地名称或区域即可匹配，也可以填写其他地点。',
    noLocationMatches: '没有匹配的现有场地，将按你输入的地点保存。',
    requestMessage: '留言',
    requestMessageHint: '可填写人数、备选时间或其他需要说明的信息。',
    submitRequest: '提交预约',
    submittingRequest: '提交中…',
    requestSubmitted: '预约请求已收到',
    requestSubmittedIntro: '我们已保存你的预约请求，并会通过下方联系方式与你联系。',
    requestReference: '预约编号',
    requestInvalid: '请填写所有必填项，并检查日期和时间。',
    requestList: '预约请求',
    requestListIntro: '查看用户的提前预约，并更新处理进度。',
    manageRequests: '预约请求',
    noRequests: '暂时没有预约请求。',
    requestedOn: '提交时间',
    pendingRequest: '新请求',
    reviewingRequest: '处理中',
    completedRequest: '已完成',
    markReviewing: '开始处理',
    markCompleted: '标记完成',
  },
} as const;

function getVenue(venueId: string, venueList: Venue[] = venues): Venue {
  return venueList.find((venue) => venue.id === venueId) ?? venueList[0] ?? venues[0];
}

function normalizeLocation(value: string) {
  return value.trim().toLocaleLowerCase();
}

function venueLabel(venue: Venue) {
  return venue.name;
}

function venueSearchText(venue: Venue) {
  return [venue.name, venue.nameZh, venue.area, venue.areaZh].join(' ').toLocaleLowerCase();
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

function preferredFormatName(
  format: PreferredFormat,
  labels: { singles: string; doubles: string; both: string },
) {
  return labels[format];
}

function preferredTimeLabel(value: PreferredTime, t: {
  weekends: string;
  weekdayEvenings: string;
  anytime: string;
  mornings: string;
  afternoons: string;
}) {
  const labels: Record<PreferredTime, string> = {
    weekends: t.weekends,
    weekday_evenings: t.weekdayEvenings,
    anytime: t.anytime,
    mornings: t.mornings,
    afternoons: t.afternoons,
  };
  return labels[value];
}

function profileFormFromUser(user: UserProfile): ProfileForm {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone,
    postcode: user.postcode,
    tennisLevel: user.tennisLevel,
    preferredTime: user.preferredTime,
    preferredFormat: user.preferredFormat,
  };
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

function normalizeVenue(value: unknown): Venue | null {
  if (!value || typeof value !== 'object') return null;
  const venue = value as Partial<Venue>;
  if (
    typeof venue.id !== 'string' || typeof venue.name !== 'string' ||
    typeof venue.nameZh !== 'string' || typeof venue.area !== 'string' ||
    typeof venue.areaZh !== 'string' || typeof venue.photo !== 'string'
  ) return null;
  const peakPricePence = Number(venue.peakPricePence);
  const offPeakPricePence = Number(venue.offPeakPricePence);
  if (!Number.isInteger(peakPricePence) || !Number.isInteger(offPeakPricePence)) return null;
  return {
    id: venue.id,
    name: venue.name,
    nameZh: venue.nameZh,
    area: venue.area,
    areaZh: venue.areaZh,
    photo: venue.photo,
    peakPricePence,
    offPeakPricePence,
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

function dateFromToday(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requestStatusLabel(status: ReservationRequestStatus, labels: {
  pendingRequest: string;
  reviewingRequest: string;
  completedRequest: string;
}) {
  if (status === 'reviewing') return labels.reviewingRequest;
  if (status === 'completed') return labels.completedRequest;
  return labels.pendingRequest;
}

function emptyDraft(venueList: Venue[] = venues): SessionDraft {
  const defaultDate = createDemoSessions()[6]?.date ?? createDemoSessions()[0]?.date ?? '';
  const venue = getVenue(venueList[0]?.id ?? venues[0].id, venueList);
  return {
    id: null,
    venueId: venue.id,
    date: defaultDate,
    startTime: '18:30',
    endTime: '20:30',
    price: String(venue.offPeakPricePence / 100),
    capacity: '8',
    formats: [...GAME_FORMATS],
    description: 'A friendly tennis session for new and returning players.',
    descriptionZh: '适合新朋友和熟悉球友的轻松网球活动。',
    status: 'published',
  };
}

function emptyVenueDraft(venueList: Venue[] = venues): VenueDraft {
  const venue = venueList[0];
  return {
    id: null,
    name: '',
    nameZh: '',
    area: '',
    areaZh: '',
    photo: '',
    peakPrice: String((venue?.peakPricePence ?? DEFAULT_PEAK_PRICE_PENCE) / 100),
    offPeakPrice: String((venue?.offPeakPricePence ?? DEFAULT_OFF_PEAK_PRICE_PENCE) / 100),
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
  const [venueList, setVenueList] = useState<Venue[]>(venues);
  const [sessions, setSessions] = useState<Session[]>(seededSessions);
  const [bookings, setBookings] = useState<Booking[]>(seededBookings);
  const [reservationRequests, setReservationRequests] = useState<ReservationRequest[]>([]);
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
  const [confirmationEmailStatus, setConfirmationEmailStatus] = useState<ConfirmationEmailStatus>('not_applicable');
  const [adminTab, setAdminTab] = useState<AdminTab>('sessions');
  const [draft, setDraft] = useState<SessionDraft>(() => emptyDraft(venues));
  const [venueDraft, setVenueDraft] = useState<VenueDraft>(() => emptyVenueDraft(venues));
  const [adminMessage, setAdminMessage] = useState('');
  const [sessionImportMessage, setSessionImportMessage] = useState('');
  const [sessionImportFailed, setSessionImportFailed] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
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
    venueId: null,
    venueName: '',
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
  const availableCoupons = loyalty?.coupons.filter((coupon) => coupon.status === 'available') ?? [];
  const selectedCoupon = availableCoupons.find((coupon) => coupon.id === selectedCouponId) ?? null;

  async function loadLoyaltyStatus() {
    setLoyaltyLoading(true);
    try {
      const response = await fetch('/api/loyalty', { cache: 'no-store' });
      const data = await response.json() as { loyalty?: LoyaltyStatus };
      if (response.ok && data.loyalty) {
        setLoyalty(data.loyalty);
        const defaultCoupon = data.loyalty.coupons.find((coupon) => coupon.status === 'available' && new Date(coupon.expiresAt).getTime() > Date.now());
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
      const savedSessions = window.localStorage.getItem(SESSION_STORAGE_KEY);
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
        const data = await response.json() as { booking?: Booking; confirmationEmailStatus?: ConfirmationEmailStatus };
        if (!cancelled && data.booking?.status === 'confirmed') {
          setSelectedSessionId(data.booking.sessionId);
          setConfirmation(normalizeBooking(data.booking));
          setConfirmationEmailStatus(data.confirmationEmailStatus ?? 'in_progress');
          void loadLoyaltyStatus();
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
    void loadVenues();
    void loadUserSession();
    void reconcileCheckout();
    return () => { cancelled = true; };
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
    void loadAdminBookings();
    void loadAdminVenues();
    void loadReservationRequests();
    return () => { cancelled = true; };
  }, [adminAuthChecked, adminAuthenticated, hydrated, view]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(bookings));
    window.localStorage.setItem(VENUE_STORAGE_KEY, JSON.stringify(venueList));
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
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

  const allSessions = useMemo(() => [...sessions].sort(sessionSort), [sessions]);
  const couponDiscountPence = selectedSession && selectedCoupon
    ? (selectedSession.pricePence - Math.floor(selectedSession.pricePence * (100 - selectedCoupon.discountPercent) / 100)) * bookingForm.participants.length
    : 0;
  const totalPence = selectedSession
    ? selectedSession.pricePence * bookingForm.participants.length +
      bookingForm.racketCount * RACKET_PRICE_PENCE - couponDiscountPence
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
    if (nextView === 'admin' && view !== 'admin') {
      setAdminAuthenticated(false);
      setAdminAuthChecked(false);
    }
    setView(nextView);
    scrollTop();
  }

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      if (path === '/admin') {
        setAdminAuthenticated(false);
        setAdminAuthChecked(false);
      }
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

  function openReservationRequest() {
    setRequestForm((current) => ({
      ...current,
      venueId: null,
      venueName: '',
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
    const defaultCoupon = availableCoupons[0];
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
    const valid = requestForm.venueName.trim() && requestForm.preferredDate >= dateFromToday(0) &&
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
    setVenueDraft({
      id: venue.id,
      name: venue.name,
      nameZh: venue.nameZh,
      area: venue.area,
      areaZh: venue.areaZh,
      photo: venue.photo,
      peakPrice: String(venue.peakPricePence / 100),
      offPeakPrice: String(venue.offPeakPricePence / 100),
    });
    setAdminMessage('');
    scrollTop();
  }

  function chooseVenueImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setAdminMessage(t.imageTooLarge);
      event.currentTarget.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setVenueDraft((current) => ({ ...current, photo: reader.result as string }));
        setAdminMessage('');
      }
    };
    reader.readAsDataURL(file);
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
      !venueDraft.name.trim() || !venueDraft.nameZh.trim() || !venueDraft.area.trim() ||
      !venueDraft.areaZh.trim() || !venueDraft.photo.trim() ||
      !venueDraft.peakPrice.trim() || !venueDraft.offPeakPrice.trim() ||
      !Number.isInteger(peakPricePence) || peakPricePence < 0 ||
      !Number.isInteger(offPeakPricePence) || offPeakPricePence < 0 ||
      peakPricePence < offPeakPricePence
    ) {
      setAdminMessage(peakPricePence < offPeakPricePence ? t.priceRule : t.venueSaveFailed);
      return;
    }
    const existing = venueDraft.id ? venueList.find((venue) => venue.id === venueDraft.id) : undefined;
    const nextVenue: Venue = {
      id: venueDraft.id ?? `venue-${crypto.randomUUID()}`,
      name: venueDraft.name.trim(),
      nameZh: venueDraft.nameZh.trim(),
      area: venueDraft.area.trim(),
      areaZh: venueDraft.areaZh.trim(),
      photo: venueDraft.photo.trim(),
      peakPricePence,
      offPeakPricePence,
    };
    setAdminBusy(true);
    let savedOnServer = false;
    let useLocalFallback = false;
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
            photo: nextVenue.photo,
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
        useLocalFallback = true;
      } else {
        setAdminMessage(t.venueSaveFailed);
      }
    } catch {
      useLocalFallback = true;
    }
    if (!savedOnServer && useLocalFallback) {
      setVenueList((current) => existing
        ? current.map((venue) => (venue.id === existing.id ? nextVenue : venue))
        : [...current, nextVenue]);
    }
    if (savedOnServer || useLocalFallback) {
      setVenueDraft(emptyVenueDraft(venueList));
      setAdminMessage(t.venueSaved);
    }
    setAdminBusy(false);
  }

  async function resetDemo() {
    if (!window.confirm(t.resetConfirm)) return;
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
      // Fall back to a browser-only reset for local previews without Postgres.
    }
    if (resetUnauthorized) {
      setAdminBusy(false);
      return;
    }
    if (!resetFromServer && !resetUnauthorized) {
      const nextSessions = createDemoSessions() as Session[];
      setSessions(nextSessions);
      setBookings(createDemoBookings(nextSessions) as Booking[]);
    }
    setConfirmation(null);
    setSelectedSessionId(null);
    setDraft(emptyDraft(nextVenues));
    setVenueDraft(emptyVenueDraft(nextVenues));
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
    if (savedOnServer || useLocalFallback) setDraft(emptyDraft(venueList));
    setAdminBusy(false);
  }

  async function importSessions(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setSessionImportMessage('');
    setSessionImportFailed(false);
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
        sessions?: Session[];
        importedCount?: number;
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
          setSessionImportMessage(t.sessionImportInvalidRows.replace('{rows}', rowList));
        } else if (data.error === 'duplicate_import_rows') {
          setSessionImportMessage(t.sessionImportDuplicateRows.replace('{rows}', rowList));
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
      setSessionImportMessage(t.sessionImportSuccess.replace('{count}', String(data.importedCount ?? data.sessions.length)));
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
          <button type="button" className={view === 'account' ? 'active' : ''} onClick={() => navigate('account')}>
            <UserRound size={15} /> {user ? user.name : t.account}
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
    const venue = getVenue(session.venueId, venueList);
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
              <p className="eyebrow muted">{venue.area}</p>
              <h3>{venue.name}</h3>
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
            <button type="button" className="request-cta" onClick={openReservationRequest}>
              <span className="request-cta-icon"><CalendarPlus size={19} /></span>
              <span><strong>{t.requestCta}</strong><small>{t.requestCtaHint}</small></span>
              <ArrowRight size={17} />
            </button>
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

  function renderReservationRequest() {
    if (submittedRequest) {
      const venue = submittedRequest.venueId ? getVenue(submittedRequest.venueId, venueList) : null;
      const requestLocation = venue ? venueLabel(venue) : submittedRequest.venueName;
      return (
        <section className="request-page page-width">
          <div className="request-card request-success-card">
            <div className="success-icon"><Check size={28} /></div>
            <p className="eyebrow">{t.requestSubmitted}</p>
            <h1>{t.requestSubmitted}</h1>
            <p className="form-intro">{t.requestSubmittedIntro}</p>
            <div className="reference-box"><span>{t.requestReference}</span><strong>{submittedRequest.id}</strong></div>
            <div className="request-summary">
              <div><small>{t.location}</small><strong>{requestLocation}</strong></div>
              <div><small>{t.preferredDate}</small><strong>{formatLongDate(submittedRequest.preferredDate, language)}</strong></div>
              <div><small>{t.preferredTimeRange}</small><strong>{submittedRequest.startTime}–{submittedRequest.endTime}</strong></div>
              <div><small>{t.contact}</small><strong>{submittedRequest.contactName}</strong><span>{submittedRequest.email}</span></div>
            </div>
            <div className="request-guarantee"><ShieldCheck size={18} /><span>{t.requestPromise}</span></div>
            <Button size="lg" className="primary-wide" onClick={() => navigate('home')}>{t.browseMore}<ArrowRight size={17} /></Button>
          </div>
        </section>
      );
    }
    return (
      <section className="request-page page-width">
        <button type="button" className="back-link" onClick={() => navigate('home')}><ArrowLeft size={16} /> {t.back}</button>
        <div className="request-card">
          <div className="request-heading">
            <p className="eyebrow"><CalendarPlus size={14} /> {t.requestCta}</p>
            <h1>{t.requestTitle}</h1>
            <p className="form-intro">{t.requestIntro}</p>
            <div className="request-guarantee"><ShieldCheck size={18} /><span>{t.requestPromise}</span></div>
          </div>
          <form onSubmit={submitReservationRequest}>
            <div className="form-grid two-col">
              <div className="field request-location-field">
                <Label htmlFor="request-venue">{t.location} <em>*</em></Label>
                <div className="venue-autocomplete">
                  <Input
                    id="request-venue"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls="request-venue-options"
                    aria-expanded={requestVenueOpen}
                    aria-activedescendant={requestVenueActiveIndex >= 0 ? `request-venue-option-${requestVenueActiveIndex}` : undefined}
                    autoComplete="off"
                    maxLength={160}
                    placeholder={t.locationPlaceholder}
                    value={requestForm.venueName}
                    onChange={(event) => updateRequestVenueName(event.target.value)}
                    onFocus={() => { setRequestVenueOpen(true); setRequestVenueActiveIndex(-1); }}
                    onBlur={() => window.setTimeout(() => setRequestVenueOpen(false), 120)}
                    onKeyDown={handleRequestVenueKeyDown}
                  />
                  {requestVenueOpen ? (
                    <div id="request-venue-options" className="venue-autocomplete-menu" role="listbox">
                      {requestVenueSuggestions.length ? requestVenueSuggestions.map((venue, index) => (
                        <button
                          type="button"
                          id={`request-venue-option-${index}`}
                          role="option"
                          aria-selected={requestVenueActiveIndex === index}
                          className={requestVenueActiveIndex === index ? 'venue-autocomplete-option active' : 'venue-autocomplete-option'}
                          key={venue.id}
                          onPointerDown={(event) => event.preventDefault()}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectRequestVenue(venue)}
                        >
                          <strong>{venueLabel(venue)}</strong>
                          <span>{venue.area}</span>
                        </button>
                      )) : <div className="venue-autocomplete-empty">{t.noLocationMatches}</div>}
                    </div>
                  ) : null}
                </div>
                <small className="field-hint">{t.locationHint}</small>
              </div>
              <div className="field"><Label htmlFor="request-date">{t.preferredDate} <em>*</em></Label><Input id="request-date" type="date" min={dateFromToday(0)} value={requestForm.preferredDate} onChange={(event) => setRequestForm((current) => ({ ...current, preferredDate: event.target.value }))} /></div>
              <div className="field request-time-field"><Label htmlFor="request-start">{t.preferredTimeRange} <em>*</em></Label><div className="time-pair"><Input id="request-start" type="time" value={requestForm.startTime} onChange={(event) => setRequestForm((current) => ({ ...current, startTime: event.target.value }))} /><span>–</span><Input aria-label={language === 'zh' ? '结束时间' : 'End time'} type="time" value={requestForm.endTime} onChange={(event) => setRequestForm((current) => ({ ...current, endTime: event.target.value }))} /></div></div>
              <div className="field"><Label htmlFor="request-name">{t.name} <em>*</em></Label><Input id="request-name" autoComplete="name" value={requestForm.contactName} onChange={(event) => setRequestForm((current) => ({ ...current, contactName: event.target.value }))} /></div>
              <div className="field"><Label htmlFor="request-email">{t.email} <em>*</em></Label><Input id="request-email" type="email" autoComplete="email" value={requestForm.email} onChange={(event) => setRequestForm((current) => ({ ...current, email: event.target.value }))} /></div>
              <div className="field"><Label htmlFor="request-phone">{t.phone} <small>({t.optional})</small></Label><Input id="request-phone" type="tel" autoComplete="tel" value={requestForm.phone} onChange={(event) => setRequestForm((current) => ({ ...current, phone: event.target.value }))} /></div>
              <div className="field request-message-field"><Label htmlFor="request-message">{t.requestMessage} <small>({t.optional})</small></Label><textarea id="request-message" className="native-textarea" rows={4} maxLength={1000} placeholder={t.requestMessageHint} value={requestForm.message} onChange={(event) => setRequestForm((current) => ({ ...current, message: event.target.value }))} /></div>
            </div>
            {requestError ? <div className="inline-error"><TriangleAlert size={16} /> {requestError}</div> : null}
            <Button type="submit" size="lg" className="request-submit" disabled={requestBusy}>{requestBusy ? t.submittingRequest : t.submitRequest}<ArrowRight size={17} /></Button>
          </form>
        </div>
      </section>
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
            <div className="detail-image-caption"><MapPin size={16} /> {selectedVenue.name} · {selectedVenue.area}</div>
          </div>
          <div className="detail-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> {t.sessionDetails}</p>
            <h1>{selectedVenue.name}</h1>
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
          <h3>{selectedVenue.name}</h3>
          <p className="summary-date"><CalendarDays size={15} /> {formatDate(selectedSession.date, language)} · {selectedSession.startTime}–{selectedSession.endTime}</p>
          <p className="summary-format"><CircleDot size={15} /> {t.format}: {bookingForm.format ? formatNames([bookingForm.format], t) : ''}</p>
          <div className="summary-lines">
            <div><span>{t.sessionFee} × {bookingForm.participants.length}</span><strong>{formatMoney(selectedSession.pricePence * bookingForm.participants.length, language)}</strong></div>
            {selectedCoupon ? <div className="summary-discount"><span>{t.couponDiscount} ({selectedCoupon.discountPercent}%)</span><strong>−{formatMoney(couponDiscountPence, language)}</strong></div> : null}
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
              {user && availableCoupons.length ? (
                <div className="coupon-picker field">
                  <Label htmlFor="booking-coupon">{t.applyCoupon}</Label>
                  <select id="booking-coupon" className="native-select" value={selectedCouponId} onChange={(event) => setSelectedCouponId(event.target.value)}>
                    <option value="">{t.noCoupon}</option>
                    {availableCoupons.map((coupon) => <option key={coupon.id} value={coupon.id}>{coupon.code} · {coupon.discountPercent}% · {t.couponExpires.replace('{date}', formatDate(coupon.expiresAt.slice(0, 10), language))}</option>)}
                  </select>
                </div>
              ) : null}
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
            {user ? <p className="profile-prefill-notice"><Check size={15} /> {t.signedInPrefill}</p> : null}
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
    const venue = getVenue(session.venueId, venueList);
    return (
      <section className="confirmation-page page-width">
        <div className="confirmation-card">
          <div className="success-icon"><Check size={28} strokeWidth={3} /></div>
          <p className="eyebrow"><span className="eyebrow-dot" /> {t.confirmed}</p>
          <h1>{t.confirmed}</h1>
          <p className="confirmation-intro">{t.confirmationIntro}</p>
          <div className="reference-box"><span>{t.bookingReference}</span><strong>{confirmation.id}</strong></div>
          <div className="confirmation-details">
            <div><img src={venue.photo} alt="" /><span><small>{t.location}</small><strong>{venue.name}</strong></span></div>
            <div><CalendarDays size={18} /><span><small>{t.date}</small><strong>{formatLongDate(session.date, language)}</strong></span></div>
            <div><CircleDot size={18} /><span><small>{t.format}</small><strong>{formatNames([confirmation.format], t)}</strong></span></div>
            <div><Users size={18} /><span><small>{t.participants}</small><strong>{confirmation.participants.length} {confirmation.participants.length === 1 ? t.person : t.people}</strong></span></div>
            <div><CreditCard size={18} /><span><small>{t.rental}</small><strong>{confirmation.racketCount} {confirmation.racketCount === 1 ? t.racket : t.rackets}</strong></span></div>
            <div><CreditCard size={18} /><span><small>{t.total}</small><strong>{formatMoney(confirmation.totalPence, language)}</strong></span></div>
          </div>
          <div className="participant-chips">{confirmation.participants.map((level, index) => <span key={`${level}-${index}`}>{index === 0 ? t.name : `${t.friendLevel} ${index}`} · {level}</span>)}</div>
          <div className="confirmation-fee-breakdown" aria-label={t.orderSummary}>
            <div><span>{t.sessionFee} × {confirmation.participants.length}</span><strong>{formatMoney(session.pricePence * confirmation.participants.length, language)}</strong></div>
            {confirmation.couponDiscountPence ? <div className="summary-discount"><span>{t.couponDiscount}</span><strong>−{formatMoney(confirmation.couponDiscountPence, language)}</strong></div> : null}
            <div><span>{t.racketFee} × {confirmation.racketCount}</span><strong>{formatMoney(confirmation.racketCount * RACKET_PRICE_PENCE, language)}</strong></div>
            <div><span>{t.total}</span><strong>{formatMoney(confirmation.totalPence, language)}</strong></div>
          </div>
          {confirmationEmailStatus === 'sent' ? <p className="confirmation-notice"><CalendarDays size={15} /> {t.emailConfirmationSent} <strong>{confirmation.email}</strong>.</p> : null}
          {confirmationEmailStatus === 'in_progress' ? <p className="confirmation-notice"><CalendarDays size={15} /> {t.emailConfirmationPending}</p> : null}
          {confirmationEmailStatus === 'skipped' ? <p className="confirmation-notice"><TriangleAlert size={15} /> {t.emailConfirmationSkipped}</p> : null}
          {confirmationEmailStatus === 'failed' ? <p className="confirmation-notice"><TriangleAlert size={15} /> {t.emailConfirmationFailed}</p> : null}
          <p className="confirmation-notice"><ShieldCheck size={15} /> {t.demoNotice}</p>
          <Button size="lg" className="primary-wide" onClick={() => navigate('home')}>{t.browseMore}<ArrowRight size={17} /></Button>
        </div>
      </section>
    );
  }

  function renderAccount() {
    if (!userAuthChecked) {
      return <section className="account-page page-width"><div className="account-card"><p>{t.checkingAccess}</p></div></section>;
    }
    if (user) {
      return (
        <section className="account-page page-width">
          <div className="account-card profile-card">
            <div className="profile-avatar"><UserRound size={28} /></div>
            <p className="eyebrow"><span className="eyebrow-dot" /> {profileEditing ? t.editProfile : t.memberSince}</p>
            <h1>{profileEditing ? t.editProfile : <>{t.welcomeBack}, {user.name}</>}</h1>
            <p className="form-intro">{profileEditing ? t.editProfileIntro : t.accountIntro}</p>
            {profileEditing ? (
              <form className="login-fields profile-edit-form" onSubmit={submitProfileUpdate} noValidate>
                <div className="form-grid two-col">
                  <div className="field"><Label htmlFor="profile-name">{t.name} <em>*</em></Label><Input id="profile-name" autoComplete="name" required value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div className="field"><Label htmlFor="profile-phone">{t.phone} <small>({t.optional})</small></Label><Input id="profile-phone" autoComplete="tel" inputMode="tel" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></div>
                </div>
                <div className="field"><Label htmlFor="profile-email">{t.email} <em>*</em></Label><Input id="profile-email" autoComplete="email" inputMode="email" required value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} /></div>
                <div className="field"><Label htmlFor="profile-postcode">{t.postcode} <small>({t.optional})</small></Label><Input id="profile-postcode" autoComplete="postal-code" value={profileForm.postcode} onChange={(event) => setProfileForm((current) => ({ ...current, postcode: event.target.value.toUpperCase() }))} /></div>
                <div className="form-grid two-col">
                  <div className="field"><Label htmlFor="profile-level">{t.tennisLevel} <em>*</em></Label><select id="profile-level" required className="native-select" value={profileForm.tennisLevel} onChange={(event) => setProfileForm((current) => ({ ...current, tennisLevel: event.target.value }))}><option value="">{language === 'zh' ? '请选择水平' : 'Select level'}</option>{LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></div>
                  <div className="field"><Label htmlFor="profile-format">{t.preferredFormat} <em>*</em></Label><select id="profile-format" className="native-select" value={profileForm.preferredFormat} onChange={(event) => setProfileForm((current) => ({ ...current, preferredFormat: event.target.value as PreferredFormat }))}>{PREFERRED_FORMATS.map((format) => <option key={format} value={format}>{preferredFormatName(format, t)}</option>)}</select></div>
                </div>
                <div className="field"><Label htmlFor="profile-time">{t.preferredTime} <em>*</em></Label><select id="profile-time" className="native-select" value={profileForm.preferredTime} onChange={(event) => setProfileForm((current) => ({ ...current, preferredTime: event.target.value as PreferredTime }))}>{PREFERRED_TIMES.map((time) => <option key={time} value={time}>{preferredTimeLabel(time, t)}</option>)}</select></div>
                {profileError ? <div className="inline-error"><TriangleAlert size={16} /> {profileError}</div> : null}
                <div className="account-actions">
                  <Button type="submit" size="lg" disabled={profileBusy}>{profileBusy ? t.savingProfile : t.saveProfile}<Check size={16} /></Button>
                  <Button type="button" size="lg" variant="outline" disabled={profileBusy} onClick={cancelProfileEdit}>{t.cancelEdit}</Button>
                </div>
              </form>
            ) : (
              <>
                <div className="profile-details">
                  <div><small>{t.email}</small><strong>{user.email}</strong></div>
                  {user.phone ? <div><small>{t.phone}</small><strong>{user.phone}</strong></div> : null}
                  <div><small>{t.postcode}</small><strong>{user.postcode}</strong></div>
                  <div><small>{t.tennisLevel}</small><strong>{user.tennisLevel}</strong></div>
                  <div><small>{t.preferredTime}</small><strong>{preferredTimeLabel(user.preferredTime, t)}</strong></div>
                  <div><small>{t.preferredFormat}</small><strong>{preferredFormatName(user.preferredFormat, t)}</strong></div>
                </div>
                <div className="loyalty-card">
                  <div className="loyalty-card-heading">
                    <div><p className="eyebrow muted">{t.loyaltyTitle}</p><h2>{loyalty ? `${t.participationCount}: ${loyalty.participationCount}` : t.loyaltyTitle}</h2></div>
                    <span className="loyalty-badge">50%</span>
                  </div>
                  {loyaltyLoading && !loyalty ? <p className="form-intro">{t.checkingAccess}</p> : null}
                  {loyalty ? <>
                    <div className="loyalty-progress" aria-label={t.rewardProgress.replace('{count}', String(loyalty.participationCount % 10)).replace('{target}', '10')}><span style={{ width: `${Math.min(100, (loyalty.participationCount % 10) * 10)}%` }} /></div>
                    <p className="form-intro">{(loyalty.participationCount > 0 && loyalty.participationCount % 10 === 0 ? t.rewardEarned : t.nextReward.replace('{count}', String(loyalty.nextRewardAt)))}</p>
                    {loyalty.coupons.length ? <div className="coupon-list">
                      {loyalty.coupons.map((coupon) => <div className="coupon-row" key={coupon.id}>
                        <div><strong>{coupon.code}</strong><small>{coupon.discountPercent}% · {t.couponExpires.replace('{date}', formatDate(coupon.expiresAt.slice(0, 10), language))}</small></div>
                        <Badge variant={coupon.status === 'available' ? 'default' : 'secondary'}>{coupon.status === 'available' ? t.applyCoupon : coupon.status === 'redeemed' ? t.couponUsed : coupon.status === 'reserved' ? t.couponPending : t.couponExpired}</Badge>
                      </div>)}
                    </div> : <p className="form-intro">{t.noCoupons}</p>}
                  </> : null}
                </div>
                <div className="account-actions">
                  <Button size="lg" onClick={beginProfileEdit}><Pencil size={16} />{t.editProfile}</Button>
                  <Button size="lg" variant="outline" onClick={() => navigate('home')}>{t.browseMore}<ArrowRight size={16} /></Button>
                  <Button size="lg" variant="outline" onClick={() => void logoutUser()}>{t.logout}</Button>
                </div>
              </>
            )}
          </div>
        </section>
      );
    }
    return (
      <section className="account-page page-width">
        <div className="account-card">
          <p className="eyebrow"><span className="eyebrow-dot" /> {t.accountTitle}</p>
          <h1>{authMode === 'login' ? t.signIn : t.createAccount}</h1>
          <p className="form-intro">{authMode === 'login' ? t.loginIntro : t.registerIntro}</p>
          <div className="auth-tabs" role="tablist">
            <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setAuthError(''); }}>{t.signIn}</button>
            <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => { setAuthMode('register'); setAuthError(''); }}>{t.createAccount}</button>
          </div>
          <form onSubmit={submitUserAuth} noValidate>
            <div className="login-fields">
              {authMode === 'register' ? <>
                <div className="form-grid two-col">
                  <div className="field"><Label htmlFor="register-name">{t.name} <em>*</em></Label><Input id="register-name" autoComplete="name" required value={registrationForm.name} onChange={(event) => setRegistrationForm((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div className="field"><Label htmlFor="register-phone">{t.phone} <small>({t.optional})</small></Label><Input id="register-phone" autoComplete="tel" inputMode="tel" value={registrationForm.phone} onChange={(event) => setRegistrationForm((current) => ({ ...current, phone: event.target.value }))} /></div>
                </div>
                <div className="field"><Label htmlFor="register-email">{t.email} <em>*</em></Label><Input id="register-email" autoComplete="email" inputMode="email" required value={registrationForm.email} onChange={(event) => setRegistrationForm((current) => ({ ...current, email: event.target.value }))} /></div>
                <div className="field"><Label htmlFor="register-password">{t.password} <em>*</em> <small>({t.passwordHint})</small></Label><Input id="register-password" type="password" autoComplete="new-password" minLength={8} required value={registrationForm.password} onChange={(event) => setRegistrationForm((current) => ({ ...current, password: event.target.value }))} /></div>
                <div className="field"><Label htmlFor="register-postcode">{t.postcode} <small>({t.optional})</small></Label><Input id="register-postcode" autoComplete="postal-code" value={registrationForm.postcode} onChange={(event) => setRegistrationForm((current) => ({ ...current, postcode: event.target.value.toUpperCase() }))} /></div>
                <div className="form-grid two-col">
                  <div className="field"><Label htmlFor="register-level">{t.tennisLevel} <em>*</em></Label><select id="register-level" required className="native-select" value={registrationForm.tennisLevel} onChange={(event) => setRegistrationForm((current) => ({ ...current, tennisLevel: event.target.value }))}><option value="">{language === 'zh' ? '请选择水平' : 'Select level'}</option>{LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></div>
                  <div className="field"><Label htmlFor="register-format">{t.preferredFormat} <em>*</em></Label><select id="register-format" className="native-select" value={registrationForm.preferredFormat} onChange={(event) => setRegistrationForm((current) => ({ ...current, preferredFormat: event.target.value as PreferredFormat }))}>{PREFERRED_FORMATS.map((format) => <option key={format} value={format}>{preferredFormatName(format, t)}</option>)}</select></div>
                </div>
                <div className="field"><Label htmlFor="register-time">{t.preferredTime} <em>*</em></Label><select id="register-time" className="native-select" value={registrationForm.preferredTime} onChange={(event) => setRegistrationForm((current) => ({ ...current, preferredTime: event.target.value as PreferredTime }))}>{PREFERRED_TIMES.map((time) => <option key={time} value={time}>{preferredTimeLabel(time, t)}</option>)}</select></div>
              </> : <>
                <div className="field"><Label htmlFor="login-email">{t.email}</Label><Input id="login-email" autoComplete="email" inputMode="email" required value={loginForm.email} onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))} /></div>
                <div className="field"><Label htmlFor="login-password">{t.password}</Label><Input id="login-password" type="password" autoComplete="current-password" required value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} /></div>
              </>}
            </div>
            {authError ? <div className="inline-error"><TriangleAlert size={16} /> {authError}</div> : null}
            <Button type="submit" size="lg" className="primary-wide account-submit" disabled={authBusy}>{authBusy ? (authMode === 'login' ? t.signingIn : t.creatingAccount) : (authMode === 'login' ? t.signIn : t.createAccount)}<ArrowRight size={16} /></Button>
          </form>
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
        <div className="admin-editor-heading"><div><p className="eyebrow muted">{draft.id ? t.editSession : t.addSession}</p><h2>{draft.id ? t.editSession : t.addSession}</h2></div>{draft.id ? <button type="button" className="text-button" onClick={() => setDraft(emptyDraft(venueList))}>{t.cancelEdit}</button> : null}</div>
        <div className="form-grid two-col">
          <div className="field"><Label htmlFor="admin-venue">{t.location}</Label><select id="admin-venue" value={draft.venueId} onChange={(event) => setDraft((current) => { const venue = getVenue(event.target.value, venueList); return { ...current, venueId: event.target.value, price: current.id ? current.price : String(venue.offPeakPricePence / 100) }; })} className="native-select" disabled={hasActiveBookings}>{venueList.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></div>
          <div className="field"><Label htmlFor="admin-date">{t.date}</Label><Input id="admin-date" type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} disabled={hasActiveBookings} /></div>
          <div className="field"><Label htmlFor="admin-start">{t.time}</Label><div className="time-pair"><Input id="admin-start" type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} disabled={hasActiveBookings} /><span>–</span><Input id="admin-end" type="time" value={draft.endTime} onChange={(event) => setDraft((current) => ({ ...current, endTime: event.target.value }))} disabled={hasActiveBookings} /></div></div>
          <div className="field"><Label htmlFor="admin-price">{t.pricePerPerson}</Label><div className="input-prefix"><span>£</span><Input id="admin-price" inputMode="decimal" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} disabled={hasActiveBookings} /></div><div className="default-price-actions"><button type="button" className="text-button" onClick={() => applyVenueDefaultPrice('peak')} disabled={hasActiveBookings}>{t.usePeakPrice}</button><button type="button" className="text-button" onClick={() => applyVenueDefaultPrice('offPeak')} disabled={hasActiveBookings}>{t.useOffPeakPrice}</button></div></div>
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

  function renderVenueEditor() {
    return (
      <form className="admin-editor venue-editor" onSubmit={saveVenue}>
        <div className="admin-editor-heading">
          <div><p className="eyebrow muted">{venueDraft.id ? t.editVenue : t.addVenue}</p><h2>{venueDraft.id ? t.editVenue : t.addVenue}</h2></div>
          {venueDraft.id ? <button type="button" className="text-button" onClick={() => setVenueDraft(emptyVenueDraft(venueList))}>{t.cancelEdit}</button> : null}
        </div>
        <div className="form-grid two-col">
          <div className="field"><Label htmlFor="venue-name">{t.venueName} <em>*</em></Label><Input id="venue-name" value={venueDraft.name} onChange={(event) => setVenueDraft((current) => ({ ...current, name: event.target.value }))} /></div>
          <div className="field"><Label htmlFor="venue-name-zh">{t.venueNameZh} <em>*</em></Label><Input id="venue-name-zh" value={venueDraft.nameZh} onChange={(event) => setVenueDraft((current) => ({ ...current, nameZh: event.target.value }))} /></div>
          <div className="field"><Label htmlFor="venue-area">{t.area} <em>*</em></Label><Input id="venue-area" value={venueDraft.area} onChange={(event) => setVenueDraft((current) => ({ ...current, area: event.target.value }))} /></div>
          <div className="field"><Label htmlFor="venue-area-zh">{t.areaZh} <em>*</em></Label><Input id="venue-area-zh" value={venueDraft.areaZh} onChange={(event) => setVenueDraft((current) => ({ ...current, areaZh: event.target.value }))} /></div>
          <div className="field"><Label htmlFor="venue-peak-price">{t.peakPrice} <em>*</em></Label><div className="input-prefix"><span>£</span><Input id="venue-peak-price" inputMode="decimal" value={venueDraft.peakPrice} onChange={(event) => setVenueDraft((current) => ({ ...current, peakPrice: event.target.value }))} /></div></div>
          <div className="field"><Label htmlFor="venue-off-peak-price">{t.offPeakPrice} <em>*</em></Label><div className="input-prefix"><span>£</span><Input id="venue-off-peak-price" inputMode="decimal" value={venueDraft.offPeakPrice} onChange={(event) => setVenueDraft((current) => ({ ...current, offPeakPrice: event.target.value }))} /></div></div>
        </div>
        <div className="field venue-image-field">
          <Label htmlFor="venue-photo">{t.venueImage} <em>*</em></Label>
          <Input id="venue-photo" type="text" value={venueDraft.photo.startsWith('data:') ? '' : venueDraft.photo} placeholder={t.imageUrl} onChange={(event) => setVenueDraft((current) => ({ ...current, photo: event.target.value }))} />
          <div className="venue-upload-row"><Input id="venue-photo-file" type="file" accept="image/*" onChange={chooseVenueImage} /><span>{t.uploadImage}</span></div>
          <p className="admin-field-note">{t.imageHelp}</p>
          {venueDraft.photo ? <img className="venue-image-preview" src={venueDraft.photo} alt={venueDraft.name || t.venueImage} /> : null}
        </div>
        {adminMessage ? <div className="admin-message"><Check size={15} /> {adminMessage}</div> : null}
        <Button type="submit" disabled={adminBusy}><Check size={16} /> {adminBusy ? t.saving : t.saveVenue}</Button>
      </form>
    );
  }

  function renderAdminLogin() {
    if (!adminAuthChecked) {
      return <section className="admin-page page-width"><div className="admin-login-card"><p className="eyebrow"><Settings2 size={14} /> {t.admin}</p><h1>{t.checkingAccess}</h1></div></section>;
    }
    return (
      <section className="admin-page page-width">
        <form className="admin-login-card" onSubmit={submitAdminLogin}>
          <p className="eyebrow"><Settings2 size={14} /> {t.admin}</p>
          <h1>{t.adminLoginTitle}</h1>
          <p>{t.adminLoginIntro}</p>
          <div className="login-fields">
            <div className="field"><Label htmlFor="admin-username">{t.username}</Label><Input id="admin-username" value={adminLogin.username} onChange={(event) => setAdminLogin((current) => ({ ...current, username: event.target.value }))} autoComplete="username" /></div>
            <div className="field"><Label htmlFor="admin-password">{t.password}</Label><Input id="admin-password" type="password" value={adminLogin.password} onChange={(event) => setAdminLogin((current) => ({ ...current, password: event.target.value }))} autoComplete="current-password" /></div>
          </div>
          {adminAuthError ? <div className="inline-error"><TriangleAlert size={16} /> {adminAuthError}</div> : null}
          <Button type="submit" size="lg" disabled={adminAuthBusy}>{adminAuthBusy ? t.signingIn : t.signIn}<ArrowRight size={17} /></Button>
        </form>
      </section>
    );
  }

  function renderAdmin() {
    if (!adminAuthChecked || !adminAuthenticated) return renderAdminLogin();
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
          <div className="admin-heading-actions">
            <Button variant="outline" onClick={() => void resetDemo()} disabled={adminBusy}>
              <RefreshCw size={15} /> {t.resetDemo}
            </Button>
            <Button variant="ghost" onClick={() => void logoutAdmin()} disabled={adminBusy}>{t.logout}</Button>
          </div>
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
          <button type="button" role="tab" aria-selected={adminTab === 'requests'} className={adminTab === 'requests' ? 'active' : ''} onClick={() => setAdminTab('requests')}>
            {t.manageRequests}{reservationRequests.filter((request) => request.status === 'pending').length ? ` (${reservationRequests.filter((request) => request.status === 'pending').length})` : ''}
          </button>
          <button type="button" role="tab" aria-selected={adminTab === 'venues'} className={adminTab === 'venues' ? 'active' : ''} onClick={() => setAdminTab('venues')}>
            {t.manageVenues}
          </button>
        </div>
        {adminTab === 'sessions' ? (
          <div className="admin-session-layout">
            <div className="admin-session-list">
              <div className="admin-list-heading">
                <div><p className="eyebrow muted">{t.sessions}</p><h2>{t.upcoming}</h2></div>
                <div className="admin-session-import-actions">
                  <Badge variant="secondary">{allSessions.length}</Badge>
                  <a className={buttonVariants({ variant: 'outline', className: 'admin-template-download' })} href="/session-import-template.xlsx" download>
                    <Download size={14} /> {t.downloadSessionTemplate}
                  </a>
                  <input
                    ref={sessionImportInput}
                    className="sr-only"
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    aria-label={t.importSessions}
                    onChange={(event) => void importSessions(event)}
                  />
                  <Button variant="outline" size="sm" onClick={() => sessionImportInput.current?.click()} disabled={adminBusy}>
                    <Upload size={14} /> {adminBusy ? t.importingSessions : t.importSessions}
                  </Button>
                </div>
              </div>
              <p className="admin-session-import-help">{t.sessionImportHelp}</p>
              {sessionImportMessage ? <div className={`admin-message${sessionImportFailed ? ' import-error' : ''}`} role="status">{sessionImportMessage}</div> : null}
              {allSessions.map((session) => {
                const venue = getVenue(session.venueId, venueList);
                const spots = Math.max(0, session.capacity - session.bookedSpots);
                return (
                  <div className="admin-session-row" key={session.id}>
                    <img src={venue.photo} alt="" />
                    <div className="admin-session-row-main">
                      <div>
                        <strong>{venue.name}</strong>
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
        ) : adminTab === 'bookings' ? (
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
                      const venue = session ? getVenue(session.venueId, venueList) : getVenue(venues[0].id, venueList);
                      return (
                        <tr key={booking.id}>
                          <td><strong>{booking.contactName}</strong><span>{booking.email}</span>{booking.phone ? <span>{booking.phone}</span> : null}</td>
                          <td><strong>{venue.name}</strong><span>{session ? formatDate(session.date, language) : ''}</span></td>
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
        ) : adminTab === 'requests' ? (
          <div className="admin-bookings admin-requests">
            <div className="admin-list-heading">
              <div><p className="eyebrow muted">{t.manageRequests}</p><h2>{t.requestList}</h2><p>{t.requestListIntro}</p></div>
              <Badge variant="secondary">{reservationRequests.length}</Badge>
            </div>
            {adminMessage ? <div className="admin-message">{adminMessage}</div> : null}
            {reservationRequests.length ? (
              <div className="request-admin-list">
                {reservationRequests.map((request) => {
                  const venue = request.venueId ? getVenue(request.venueId, venueList) : null;
                  const requestLocation = venue ? venueLabel(venue) : request.venueName;
                  return (
                    <article className="request-admin-row" key={request.id}>
                      <div className="request-admin-date"><strong>{new Date(`${request.preferredDate}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { month: 'short' }).format(new Date(`${request.preferredDate}T12:00:00`))}</span></div>
                      <div className="request-admin-main">
                        <div className="request-admin-title"><strong>{requestLocation}</strong><Badge variant={request.status === 'pending' ? 'default' : 'outline'}>{requestStatusLabel(request.status, t)}</Badge></div>
                        <span><CalendarDays size={14} /> {formatLongDate(request.preferredDate, language)} · {request.startTime}–{request.endTime}</span>
                        <span><UserRound size={14} /> {request.contactName} · <a href={`mailto:${request.email}`}>{request.email}</a>{request.phone ? ` · ${request.phone}` : ''}</span>
                        {request.message ? <p>{request.message}</p> : null}
                        <small>{t.requestedOn}: {new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.createdAt))}</small>
                      </div>
                      <div className="request-admin-actions">
                        {request.status === 'pending' ? <Button variant="outline" size="sm" disabled={adminBusy} onClick={() => void updateReservationRequestStatus(request.id, 'reviewing')}>{t.markReviewing}</Button> : null}
                        {request.status !== 'completed' ? <Button size="sm" disabled={adminBusy} onClick={() => void updateReservationRequestStatus(request.id, 'completed')}><Check size={14} /> {t.markCompleted}</Button> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <div className="empty-state">{t.noRequests}</div>}
          </div>
        ) : (
          <div className="admin-venue-layout">
            <div className="admin-venue-list">
              <div className="admin-list-heading">
                <div><p className="eyebrow muted">{t.manageVenues}</p><h2>{t.venueList}</h2><p>{t.venueListIntro}</p></div>
                <div className="admin-list-heading-actions"><Badge variant="secondary">{venueList.length}</Badge><Button variant="outline" size="sm" onClick={() => { setVenueDraft(emptyVenueDraft(venueList)); setAdminMessage(''); }} disabled={adminBusy}><Plus size={14} /> {t.addVenue}</Button></div>
              </div>
              {venueList.map((venue) => (
                <div className="admin-venue-row" key={venue.id}>
                  <img src={venue.photo} alt="" />
                  <div className="admin-venue-row-main">
                    <strong>{venue.name}</strong>
                    <span>{venue.area}</span>
                    <small>{t.peakPrice}: {formatMoney(venue.peakPricePence, language)} · {t.offPeakPrice}: {formatMoney(venue.offPeakPricePence, language)}</small>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => startEditVenue(venue)} disabled={adminBusy}><Pencil size={14} /> {t.edit}</Button>
                </div>
              ))}
            </div>
            {renderVenueEditor()}
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
        {view === 'account' ? renderAccount() : null}
        {view === 'request' ? renderReservationRequest() : null}
        {view === 'admin' ? renderAdmin() : null}
      </main>
      <footer className="site-footer page-width"><span><AppMark /> Tennis Social</span><small>{t.demoNotice}</small></footer>
    </div>
  );
}

export default function Home() {
  return <TennisSocialApp />;
}
