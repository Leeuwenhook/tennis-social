export type Venue = {
  id: string;
  name: string;
  nameZh: string;
  area: string;
  areaZh: string;
  photo: string;
  peakPricePence: number;
  offPeakPricePence: number;
};

export const GAME_FORMATS = ['singles', 'doubles'] as const;
export type GameFormat = typeof GAME_FORMATS[number];

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
  status: 'published';
  description: string;
  descriptionZh: string;
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
    photo: '/venues/victoria-park.jpg',
    peakPricePence: 1500,
    offPeakPricePence: 1000,
  },
  {
    id: 'vauxhall-park',
    name: 'Vauxhall Park',
    nameZh: '沃克斯豪尔公园',
    area: 'Lambeth',
    areaZh: 'Lambeth 区',
    photo: '/venues/vauxhall-park.jpg',
    peakPricePence: 1500,
    offPeakPricePence: 1000,
  },
  {
    id: 'bethnal-green',
    name: 'Bethnal Green',
    nameZh: '贝斯纳尔格林',
    area: 'East London',
    areaZh: '东伦敦',
    photo: '/venues/bethnal-green.jpg',
    peakPricePence: 1300,
    offPeakPricePence: 900,
  },
  {
    id: 'poplar-rec-ground',
    name: 'Poplar Rec Ground',
    nameZh: 'Poplar Rec Ground',
    area: 'Poplar',
    areaZh: 'Poplar 区',
    photo: '/venues/poplar-rec-ground.jpg',
    peakPricePence: 1200,
    offPeakPricePence: 800,
  },
  {
    id: 'king-edward-memorial-park',
    name: 'King Edward Memorial Park',
    nameZh: 'King Edward Memorial Park',
    area: 'Shadwell',
    areaZh: 'Shadwell 区',
    photo: '/venues/king-edward-memorial-park.jpg',
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
    description: 'A relaxed midweek hit with rotating doubles and friendly match play.',
    descriptionZh: '轻松的工作日晚间约球，轮换双打并穿插友谊赛。',
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
    description: 'Friday evening tennis on a bright, quiet court. One place left.',
    descriptionZh: '周五晚在安静明亮的球场打球，目前只剩 1 个名额。',
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
    description: 'A full Saturday morning group with structured doubles rotations.',
    descriptionZh: '周六上午的固定小组活动，安排双打轮换。',
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
    description: 'Longer Sunday tennis with plenty of time to warm up and play through.',
    descriptionZh: '周日较长时段，留出充分热身和连续对打时间。',
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
    description: 'A riverside evening session with a mix of drills and open games.',
    descriptionZh: '河边晚间活动，结合简单练习和自由对打。',
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
    description: 'Small-group evening tennis for focused rallies and competitive points.',
    descriptionZh: '小组晚间约球，适合专注对拉和更有竞争感的回合。',
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
    description: 'A fresh Saturday morning start for singles, doubles and new faces.',
    descriptionZh: '周六上午轻松开场，欢迎单打、双打和第一次来的朋友。',
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
    description: 'A sociable Saturday session with easy drills and rotating doubles.',
    descriptionZh: '适合社交的周六活动，包含简单练习和双打轮换。',
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
    description: template.description,
    descriptionZh: template.descriptionZh,
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
