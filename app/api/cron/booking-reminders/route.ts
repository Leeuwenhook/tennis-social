import { handleBookingReminderCron } from '@/lib/server/booking-reminder-cron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleBookingReminderCron(request);
}
