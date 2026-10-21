import type { CourtSetting } from './venue-form';

export type Venue = {
  description?: string | null;
  descriptionZh?: string | null;
  id: string;
  name: string;
  nameZh: string;
  area: string;
  areaZh: string;
  /** Street-level location details are optional so older database rows remain valid. */
  address?: string;
  addressZh?: string;
  postcode?: string;
  notes?: string;
  photo: string;
  photos?: string[];
  peakPricePence: number;
  offPeakPricePence: number;
  /** Optional court details; null means not known yet. */
  courtCount?: number | null;
  courtSetting?: CourtSetting | null;
  floodlights?: boolean | null;
  /** Archived venues stay attached to their sessions but cannot be picked for new ones. */
  archivedAt?: string | null;
  updatedAt?: string;
};

export const GAME_FORMATS = ['singles', 'doubles'] as const;
export type GameFormat = typeof GAME_FORMATS[number];

export const PREFERRED_FORMATS = ['singles', 'doubles', 'both'] as const;
export type PreferredFormat = typeof PREFERRED_FORMATS[number];

export type DemoSession = {
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
  status: 'published';
};

export type DemoBooking = {
  id: string;
  sessionId: string;
  contactName: string;
  email: string;
  phone: string;
  participants: string[];
  format: GameFormat;
  racketCount: number;
  totalPence: number;
  status: 'confirmed';
  createdAt: string;
};

export const RACKET_PRICE_PENCE = 200;
export const DEFAULT_PEAK_PRICE_PENCE = 1200;
export const DEFAULT_OFF_PEAK_PRICE_PENCE = 900;

export const venues: Venue[] = [
  {
    id: 'victoria-park',
    name: 'Victoria Park',
    nameZh: '维多利亚公园',
    area: 'Tower Hamlets',
    areaZh: 'Tower Hamlets 区',
    address: 'Victoria Park Tennis Courts, Grove Road, London',
    addressZh: 'Victoria Park 网球场，Grove Road，伦敦',
    postcode: 'E9 5HT',
    photo: '/venues/victoria-park.jpg',
    photos: ['/venues/victoria-park.jpg', '/venues/victoria-park-original.jpg'],
    peakPricePence: 1500,
    offPeakPricePence: 1000,
  },
  {
    id: 'vauxhall-park',
    name: 'Vauxhall Park',
    nameZh: '沃克斯豪尔公园',
    area: 'Lambeth',
    areaZh: 'Lambeth 区',
    address: 'Vauxhall Park Tennis Courts, Lawn Lane, London',
    addressZh: 'Vauxhall Park 网球场，Lawn Lane，伦敦',
    postcode: 'SW8 1UD',
    photo: '/venues/vauxhall-park.jpg',
    photos: ['/venues/vauxhall-park.jpg', '/venues/vauxhall-park-original.jpg'],
    peakPricePence: 1500,
    offPeakPricePence: 1000,
  },
  {
    id: 'bethnal-green',
    name: 'Bethnal Green',
    nameZh: '贝斯纳尔格林',
    area: 'East London',
    areaZh: '东伦敦',
    address: 'Bethnal Green Gardens Tennis Courts, Cambridge Heath Road, London',
    addressZh: 'Bethnal Green Gardens 网球场，Cambridge Heath Road，伦敦',
    postcode: 'E2 0EU',
    photo: '/venues/bethnal-green.jpg',
    photos: ['/venues/bethnal-green.jpg', '/venues/bethnal-green-original.jpg'],
    peakPricePence: 1300,
    offPeakPricePence: 900,
  },
  {
    id: 'poplar-rec-ground',
    name: 'Poplar Rec Ground',
    nameZh: 'Poplar Rec Ground',
    area: 'Poplar',
    areaZh: 'Poplar 区',
    address: 'Poplar Rec Ground Tennis Courts, Hale Street, London',
    addressZh: 'Poplar Rec Ground 网球场，Hale Street，伦敦',
    postcode: 'E14 0BP',
    photo: '/venues/poplar-rec-ground.jpg',
    photos: ['/venues/poplar-rec-ground.jpg', '/venues/poplar-rec-ground-original.jpg'],
    peakPricePence: 1200,
    offPeakPricePence: 800,
  },
  {
    id: 'king-edward-memorial-park',
    name: 'King Edward Memorial Park',
    nameZh: 'King Edward Memorial Park',
    area: 'Shadwell',
    areaZh: 'Shadwell 区',
    address: 'King Edward Memorial Park Tennis Courts, Glamis Road, London',
    addressZh: 'King Edward Memorial Park 网球场，Glamis Road，伦敦',
    postcode: 'E1W 3TD',
    photo: '/venues/king-edward-memorial-park.jpg',
    photos: ['/venues/king-edward-memorial-park.jpg', '/venues/king-edward-memorial-park-original.jpg'],
    peakPricePence: 1600,
    offPeakPricePence: 1100,
  },
];

const sessionTemplates = [
  {
    id: 'session-victoria-midweek',
    venueId: 'victoria-park',
    dayOffset: 1,
    startTime: '18:30',
    endTime: '20:30',
    pricePence: 1000,
    capacity: 8,
    bookedSpots: 2,
    formats: ['singles', 'doubles'],
  },
  {
    id: 'session-vauxhall-evening',
    venueId: 'vauxhall-park',
    dayOffset: 2,
    startTime: '18:00',
    endTime: '20:30',
    pricePence: 1200,
    capacity: 6,
    bookedSpots: 5,
    formats: ['singles', 'doubles'],
  },
  {
    id: 'session-bethnal-saturday',
    venueId: 'bethnal-green',
    dayOffset: 3,
    startTime: '10:00',
    endTime: '12:00',
    pricePence: 900,
    capacity: 8,
    bookedSpots: 8,
    formats: ['singles', 'doubles'],
  },
  {
    id: 'session-poplar-sunday',
    venueId: 'poplar-rec-ground',
    dayOffset: 4,
    startTime: '11:30',
    endTime: '14:00',
    pricePence: 800,
    capacity: 6,
    bookedSpots: 2,
    formats: ['singles', 'doubles'],
  },
  {
    id: 'session-king-edward-evening',
    venueId: 'king-edward-memorial-park',
    dayOffset: 6,
    startTime: '18:30',
    endTime: '21:00',
    pricePence: 1100,
    capacity: 6,
    bookedSpots: 3,
    formats: ['singles', 'doubles'],
  },
  {
    id: 'session-victoria-competitive',
    venueId: 'victoria-park',
    dayOffset: 7,
    startTime: '19:00',
    endTime: '21:00',
    pricePence: 1500,
    capacity: 4,
    bookedSpots: 3,
    formats: ['singles', 'doubles'],
  },
  {
    id: 'session-vauxhall-saturday',
    venueId: 'vauxhall-park',
    dayOffset: 9,
    startTime: '09:30',
    endTime: '12:00',
    pricePence: 1000,
    capacity: 8,
    bookedSpots: 0,
    formats: ['singles', 'doubles'],
  },
  {
    id: 'session-king-edward-saturday',
    venueId: 'king-edward-memorial-park',
    dayOffset: 12,
    startTime: '10:30',
    endTime: '13:00',
    pricePence: 1300,
    capacity: 6,
    bookedSpots: 6,
    formats: ['singles', 'doubles'],
  },
] as const;

const bookingTemplates = [
  { id: 'TS-DEMO01', sessionIndex: 0, contactName: 'Alex Morgan', email: 'alex@example.com', participants: ['3.0', '3.5'], format: 'doubles', racketCount: 0 },
  { id: 'TS-DEMO02', sessionIndex: 1, contactName: 'Jamie Chen', email: 'jamie@example.com', participants: ['2.5', '3.0'], format: 'doubles', racketCount: 1 },
  { id: 'TS-DEMO03', sessionIndex: 1, contactName: 'Sam Taylor', email: 'sam@example.com', participants: ['4.0'], format: 'singles', racketCount: 0 },
  { id: 'TS-DEMO04', sessionIndex: 1, contactName: 'Morgan Lee', email: 'morgan@example.com', participants: ['3.5'], format: 'singles', racketCount: 0 },
  { id: 'TS-DEMO05', sessionIndex: 1, contactName: 'Priya Shah', email: 'priya@example.com', participants: ['3.0'], format: 'singles', racketCount: 0 },
  { id: 'TS-DEMO06', sessionIndex: 2, contactName: 'Chris Wood', email: 'chris@example.com', participants: ['3.0', '3.5', '4.0', '2.5'], format: 'doubles', racketCount: 2 },
  { id: 'TS-DEMO07', sessionIndex: 2, contactName: 'Taylor Jones', email: 'taylor@example.com', participants: ['3.0', '2.0', '4.5', '3.5'], format: 'doubles', racketCount: 1 },
  { id: 'TS-DEMO08', sessionIndex: 3, contactName: 'Robin Green', email: 'robin@example.com', participants: ['3.5', '4.0'], format: 'doubles', racketCount: 0 },
  { id: 'TS-DEMO09', sessionIndex: 4, contactName: 'Casey Smith', email: 'casey@example.com', participants: ['2.0', '3.0', '3.5'], format: 'doubles', racketCount: 1 },
  { id: 'TS-DEMO10', sessionIndex: 5, contactName: 'Jordan Patel', email: 'jordan@example.com', participants: ['4.0', '4.5', '3.5'], format: 'doubles', racketCount: 2 },
  { id: 'TS-DEMO11', sessionIndex: 7, contactName: 'Riley Evans', email: 'riley@example.com', participants: ['2.5', '3.0', '3.5'], format: 'doubles', racketCount: 1 },
  { id: 'TS-DEMO12', sessionIndex: 7, contactName: 'Avery Brown', email: 'avery@example.com', participants: ['3.0', '4.0', '4.5'], format: 'doubles', racketCount: 0 },
] as const;

function londonDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function createDemoSessions(referenceDate = new Date()): DemoSession[] {
  const baseDate = londonDateParts(referenceDate);
  return sessionTemplates.map((template) => ({
    id: template.id,
    venueId: template.venueId,
    date: addDays(baseDate, template.dayOffset),
    startTime: template.startTime,
    endTime: template.endTime,
    pricePence: template.pricePence,
    capacity: template.capacity,
    bookedSpots: template.bookedSpots,
    formats: [...template.formats],
    status: 'published' as const,
  }));
}

export function createDemoBookings(
  sessions: Array<Pick<DemoSession, 'id' | 'pricePence'>>,
  referenceDate = new Date(),
): DemoBooking[] {
  const createdAt = referenceDate.toISOString();
  return bookingTemplates.map((template) => {
    const session = sessions[template.sessionIndex];
    const totalPence = session.pricePence * template.participants.length + RACKET_PRICE_PENCE * template.racketCount;
    return {
      id: template.id,
      sessionId: session.id,
      contactName: template.contactName,
      email: template.email,
      phone: '',
      participants: [...template.participants],
      format: template.format,
      racketCount: template.racketCount,
      totalPence,
      status: 'confirmed' as const,
      createdAt,
    };
  });
}
