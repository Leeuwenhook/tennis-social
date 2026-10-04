import type { GameFormat, PreferredFormat } from '@/lib/demo-data';

export type Language = 'en' | 'zh';
export type View = 'home' | 'detail' | 'booking' | 'confirmation' | 'account' | 'request' | 'admin';
export type BookingStage = 'details' | 'payment';
export type AuthMode = 'login' | 'register';
export type AdminTab = 'sessions' | 'bookings' | 'requests' | 'venues';
export type SessionStatus = 'published' | 'draft';
export type BookingStatus = 'pending_payment' | 'confirmed' | 'expired' | 'payment_failed' | 'cancelled' | 'refunded';
export type ConfirmationEmailStatus = 'sent' | 'skipped' | 'in_progress' | 'failed' | 'not_applicable';

export type ModelContext = {
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

export type Session = {
  id: string;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  pricePence: number;
  capacity: number;
  bookedSpots: number;
  formats: GameFormat[];
  seekingLevels?: string[];
  status: SessionStatus;
  description: string;
  descriptionZh: string;
  bookingPreferences?: SessionBookingPreference[];
};

export type SessionBookingPreference = {
  level: string;
  format: GameFormat;
};

export type Booking = {
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
  loyaltyDiscountPercent?: number;
  loyaltyDiscountPence?: number;
  totalPence: number;
  status: BookingStatus;
  createdAt: string;
};

export type CouponStatus = 'available' | 'reserved' | 'redeemed' | 'expired';

export type Coupon = {
  id: string;
  code: string;
  discountPercent: number;
  milestoneCount: number;
  issuedAt: string;
  expiresAt: string;
  status: CouponStatus;
  redeemedAt: string | null;
};

export type LoyaltyStatus = {
  participationCount: number;
  nextRewardAt: number;
  permanentDiscountEligible: boolean;
  permanentDiscountPercent: number;
  legacyCouponsEnabled: boolean;
  coupons: Coupon[];
};

export type SessionDraft = {
  id: string | null;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  price: string;
  capacity: string;
  formats: GameFormat[];
  seekingLevels: string[];
  description: string;
  descriptionZh: string;
  status: SessionStatus;
};

export type VenueDraft = {
  address: string;
  addressZh: string;
  postcode: string;
  id: string | null;
  name: string;
  area: string;
  photo: string;
  photos: string[];
  notes: string;
  peakPrice: string;
  offPeakPrice: string;
};

export type SessionImportIssueCode =
  | 'venue'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'timeRange'
  | 'description'
  | 'price'
  | 'capacity'
  | 'formats'
  | 'seekingLevels'
  | 'status'
  | 'row'
  | 'duplicate';

export type ReservationRequestStatus = 'pending' | 'reviewing' | 'completed';

export type ReservationRequest = {
  id: string;
  requestType: 'known_venue' | 'find_nearby';
  venueId: string | null;
  venueName: string;
  postcode: string;
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

export type ReservationRequestForm = {
  requestType: 'known_venue' | 'find_nearby';
  venueId: string | null;
  venueName: string;
  postcode: string;
  preferredDate: string;
  startTime: string;
  endTime: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
};

export type PreferredTime = 'weekends' | 'weekday_evenings' | 'anytime' | 'mornings' | 'afternoons';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  postcode: string;
  tennisLevel: string;
  preferredTime: PreferredTime;
  preferredFormat: PreferredFormat;
};

export type ProfileForm = Omit<UserProfile, 'id'>;
