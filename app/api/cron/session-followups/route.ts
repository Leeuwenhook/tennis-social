import { handleBookingFollowupCron } from '@/lib/server/booking-followup-cron';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return handleBookingFollowupCron(request);
}
