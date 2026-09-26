import {
  database,
  DatabaseNotConfiguredError,
} from './database';
import { getRuntimeEnv } from './runtime';
import { sendDueBookingReminders } from './booking-reminders';

export async function handleBookingReminderCron(request: Request) {
  const secret = getRuntimeEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: 'cron_not_configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendDueBookingReminders(database());
    if (result.status === 'email_not_configured') {
      return Response.json({ error: 'email_not_configured' }, { status: 503 });
    }
    return Response.json(result, { status: result.failed ? 503 : 200 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to process booking reminders', error);
    return Response.json({ error: 'reminders_unavailable' }, { status: 503 });
  }
}
