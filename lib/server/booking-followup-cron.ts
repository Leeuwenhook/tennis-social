import { database, DatabaseNotConfiguredError } from './database';
import { getRuntimeEnv } from './runtime';
import {
  isLondonFollowupHour,
  sendDueBookingFollowups,
} from './booking-followups';
export async function handleBookingFollowupCron(
  request: Request,
  now = new Date(),
  run: (now: Date) => ReturnType<typeof sendDueBookingFollowups> = (time) =>
    sendDueBookingFollowups(database(), time),
) {
  const secret = getRuntimeEnv().CRON_SECRET;
  if (!secret)
    return Response.json({ error: 'cron_not_configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (
    new URL(request.url).searchParams.get('force') !== '1' &&
    !isLondonFollowupHour(now)
  )
    return Response.json({ skipped: 'outside_london_21h_22h' });
  try {
    const result = await run(now);
    if (result.status !== 'sent')
      return Response.json({ error: result.status }, { status: 503 });
    return Response.json(result, { status: result.failed ? 503 : 200 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError)
      return Response.json(
        { error: 'database_not_configured' },
        { status: 503 },
      );
    console.error('Unable to process session follow-ups');
    return Response.json({ error: 'followups_unavailable' }, { status: 503 });
  }
}
