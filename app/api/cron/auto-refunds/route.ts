import { handleAutoRefundCron } from '@/lib/server/auto-refund-cron';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return handleAutoRefundCron(request);
}
