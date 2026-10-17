import { database, DatabaseNotConfiguredError } from './database';
import { getRuntimeEnv } from './runtime';
import { sendDueBookingFollowups } from './booking-followups';
export async function handleBookingFollowupCron(request: Request) {
  const secret = getRuntimeEnv().CRON_SECRET;
  if (!secret)
    return Response.json({ error: 'cron_not_configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const result = await sendDueBookingFollowups(database());
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
