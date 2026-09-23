import {
  createDemoBookings,
  createDemoSessions,
  venues,
  type DemoBooking,
  type DemoSession,
  type Venue,
} from '../demo-data';

export type DemoSeed = {
  venues: Venue[];
  sessions: DemoSession[];
  bookings: DemoBooking[];
};

export function createDemoSeed(referenceDate = new Date()): DemoSeed {
  const sessions = createDemoSessions(referenceDate);
  return {
    venues: venues.map((venue) => ({ ...venue })),
    sessions,
    bookings: createDemoBookings(sessions, referenceDate),
  };
}
