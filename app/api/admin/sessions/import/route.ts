import {
  database,
  DatabaseNotConfiguredError,
  ensureSeeded,
  serializeSession,
  type SessionRow,
} from '@/lib/server/database';
import { validateSessionInput, type SessionInput } from '@/lib/server/admin-validation';
import { requireAdmin } from '@/lib/server/admin-auth';
import { generateSessionDescriptions } from '@/lib/server/session-description';
import { GAME_FORMATS, type GameFormat } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ImportRecord = {
  rowNumber?: unknown;
  session?: SessionInput & { venue?: unknown };
};

function normalizedName(value: unknown) {
  return typeof value === 'string' ? value.trim().normalize('NFKC').toLocaleLowerCase() : '';
}

function scheduleKey(session: { venueId: string; date: string; startTime: string; endTime: string }) {
  return `${session.venueId}|${session.date}|${session.startTime}|${session.endTime}`;
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let input: { sessions?: unknown };
  try {
    const body = await request.text();
    if (body.length > 1_500_000) return Response.json({ error: 'import_too_large' }, { status: 413 });
    input = JSON.parse(body) as { sessions?: unknown };
  } catch {
    return Response.json({ error: 'invalid_import' }, { status: 400 });
  }
  if (!Array.isArray(input.sessions) || input.sessions.length < 1) {
    return Response.json({ error: 'empty_import' }, { status: 400 });
  }
  if (input.sessions.length > 200) {
    return Response.json({ error: 'import_too_many_rows' }, { status: 400 });
  }

  try {
    const db = database();
    await ensureSeeded(db);
    const venueRows = await db`SELECT id, name, name_zh FROM venues` as Array<{ id: string; name: string; name_zh: string }>;
    const validVenueIds = venueRows.map((venue) => venue.id);
    const venuesByName = new Map<string, { id: string; name: string; nameZh: string }>();
    for (const venue of venueRows) {
      for (const name of [venue.id, venue.name, venue.name_zh]) {
        venuesByName.set(normalizedName(name), { id: venue.id, name: venue.name, nameZh: venue.name_zh });
      }
    }

    const invalidRows: number[] = [];
    const sessions: Array<{ rowNumber: number; session: NonNullable<ReturnType<typeof validateSessionInput>> }> = [];
    for (let index = 0; index < input.sessions.length; index += 1) {
      const record = input.sessions[index] as ImportRecord;
      const rowNumber = typeof record?.rowNumber === 'number' && Number.isInteger(record.rowNumber)
        ? record.rowNumber
        : index + 2;
      const source = record?.session;
      if (!source || typeof source !== 'object') {
        invalidRows.push(rowNumber);
        continue;
      }
      const venue = venuesByName.get(normalizedName(source.venue));
      const venueId = venue?.id ?? '';
      const formats = Array.isArray(source.formats)
        ? source.formats.filter((format): format is GameFormat => GAME_FORMATS.includes(format as GameFormat))
        : [];
      const generatedDescriptions = generateSessionDescriptions({
        venueName: venue?.name ?? (typeof source.venue === 'string' ? source.venue : ''),
        venueNameZh: venue?.nameZh ?? (typeof source.venue === 'string' ? source.venue : ''),
        date: typeof source.date === 'string' ? source.date : '',
        startTime: typeof source.startTime === 'string' ? source.startTime : '',
        endTime: typeof source.endTime === 'string' ? source.endTime : '',
        formats: formats.length ? formats : [...GAME_FORMATS],
        capacity: Number(source.capacity),
      });
      const description = typeof source.description === 'string' ? source.description.trim() : '';
      const descriptionZh = typeof source.descriptionZh === 'string' ? source.descriptionZh.trim() : '';
      const session = validateSessionInput({
        ...source,
        venueId,
        description: description || generatedDescriptions.description,
        descriptionZh: descriptionZh || generatedDescriptions.descriptionZh,
      }, validVenueIds);
      if (!session) invalidRows.push(rowNumber);
      else sessions.push({ rowNumber, session });
    }
    if (invalidRows.length) {
      return Response.json({ error: 'invalid_import_rows', rows: invalidRows }, { status: 400 });
    }

    const importKeys = new Map<string, number>();
    const duplicateRows = new Set<number>();
    for (const { rowNumber, session } of sessions) {
      const key = scheduleKey(session);
      if (importKeys.has(key)) {
        duplicateRows.add(importKeys.get(key) as number);
        duplicateRows.add(rowNumber);
      } else {
        importKeys.set(key, rowNumber);
      }
    }

    const dates = sessions.map(({ session }) => session.date).sort();
    const existingRows = await db`
      SELECT venue_id, date, start_time, end_time
      FROM sessions
      WHERE date >= ${dates[0]} AND date <= ${dates[dates.length - 1]}
    ` as Array<{ venue_id: string; date: string; start_time: string; end_time: string }>;
    const existingKeys = new Set(existingRows.map((session) =>
      scheduleKey({ venueId: session.venue_id, date: session.date, startTime: session.start_time, endTime: session.end_time }),
    ));
    for (const { rowNumber, session } of sessions) {
      if (existingKeys.has(scheduleKey(session))) duplicateRows.add(rowNumber);
    }
    if (duplicateRows.size) {
      return Response.json({ error: 'duplicate_import_rows', rows: [...duplicateRows].sort((a, b) => a - b) }, { status: 409 });
    }

    const now = new Date().toISOString();
    const inserts = sessions.map(({ session }) => {
      const id = `session-${crypto.randomUUID()}`;
      return db`
        INSERT INTO sessions (
          id, venue_id, date, start_time, end_time, price_pence, capacity,
          booked_spots, formats_json, status, description, description_zh, created_at, updated_at
        ) VALUES (
          ${id}, ${session.venueId}, ${session.date}, ${session.startTime}, ${session.endTime},
          ${session.pricePence}, ${session.capacity}, 0, ${JSON.stringify(session.formats)}, ${session.status},
          ${session.description}, ${session.descriptionZh}, ${now}, ${now}
        )
        RETURNING id, venue_id, date, start_time, end_time, price_pence, capacity,
                  booked_spots, formats_json, status, description, description_zh
      `;
    });
    const inserted = await db.transaction(inserts) as unknown as SessionRow[][];
    const imported = inserted.map((rows) => serializeSession(rows[0]));
    return Response.json({ sessions: imported, importedCount: imported.length }, { status: 201 });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ error: 'database_not_configured' }, { status: 503 });
    }
    console.error('Unable to import sessions', error);
    return Response.json({ error: 'session_import_unavailable' }, { status: 503 });
  }
}
