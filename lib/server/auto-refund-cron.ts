import { database, DatabaseNotConfiguredError } from './database';
import { getRuntimeEnv } from './runtime';
import { isLondonAutoRefundHour, processAutoRefunds } from './auto-refunds';

export async function handleAutoRefundCron(
  request: Request,
  now = new Date(),
  run: (now: Date) => ReturnType<typeof processAutoRefunds> = (time) => processAutoRefunds(database(), time),
) {
  const secret = getRuntimeEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: 'cron_not_configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  // Vercel runs this at 17:00 and 18:00 UTC; only the run at 18:00 London time acts.
  if (new URL(request.url).searchParams.get('force') !== '1' && !isLondonAutoRefundHour(now))
    return Response.json({ skipped: 'outside_london_18h' });
  if (!getRuntimeEnv().STRIPE_SECRET_KEY) return Response.json({ error: 'stripe_not_configured' }, { status: 503 });
  try {
    const result = await run(now);
    return Response.json(result, { status: result.failed ? 503 : 200 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError)
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    console.error('Unable to process auto refunds');
    return Response.json({ error: 'auto_refunds_unavailable' }, { status: 503 });
  }
}
