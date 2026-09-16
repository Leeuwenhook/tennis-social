import {
  createDemoBookings,
  createDemoSessions,
  type DemoBooking,
  type DemoSession,
} from '../demo-data';

export type DemoSeed = {
  sessions: DemoSession[];
  bookings: DemoBooking[];
};

export function createDemoSeed(referenceDate = new Date()): DemoSeed {
  const sessions = createDemoSessions(referenceDate);
  return {
    sessions,
    bookings: createDemoBookings(sessions, referenceDate),
  };
}
