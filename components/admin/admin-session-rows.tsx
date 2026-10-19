'use client';

import { useState } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.mjs';
import Ellipsis from 'lucide-react/dist/esm/icons/ellipsis.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';

import { CopyRosterButton, RosterList, rosterText, type RosterEntry } from '@/components/admin/admin-overview';
import { QrCodeDialog, siteOrigin } from '@/components/qr-code-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Venue } from '@/lib/demo-data';
import { formatDate } from '@/lib/formatters';
import { availableSpots, getVenue } from '@/lib/tennis-utils';
import type { Translations } from '@/lib/translations';
import type { Booking, Language, Session } from '@/types/tennis';

const copy = {
  en: { roster: 'Players', more: 'More actions' },
  zh: { roster: '名单', more: '更多操作' },
} as const;

function rosterFor(sessionId: string, bookings: Booking[]): RosterEntry[] {
  return bookings
    .filter((booking) => booking.sessionId === sessionId && (booking.status === 'confirmed' || booking.status === 'pending_payment'))
    .map((booking) => ({
      id: booking.id,
      contactName: booking.contactName,
      email: booking.email,
      phone: booking.phone,
      participants: booking.participants,
      participantCount: booking.participants.length,
      format: booking.format,
      totalPence: booking.totalPence,
      status: booking.status,
    }));
}

/**
 * The admin session list: one row per session with Edit and the player list
 * up front, and the less frequent actions (copy weeks, QR code, mark full,
 * delete) in a menu. Rows stack into cards on narrow screens.
 */
export function AdminSessionRows({
  sessions,
  venueList,
  bookings,
  selectedSessionIds,
  setSelectedSessionIds,
  adminBusy,
  language,
  t,
  onEdit,
  onCreateRecurring,
  onSetFull,
  onDelete,
}: {
  sessions: Session[];
  venueList: Venue[];
  bookings: Booking[];
  selectedSessionIds: string[];
  setSelectedSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
  adminBusy: boolean;
  language: Language;
  t: Translations;
  onEdit: (session: Session) => void;
  onCreateRecurring: (session: Session) => void;
  onSetFull: (session: Session, markedFull: boolean) => void;
  onDelete: (session: Session) => void;
}) {
  const c = copy[language];
  const [expanded, setExpanded] = useState<string | null>(null);
  const [qrSession, setQrSession] = useState<Session | null>(null);
  const allSelected = sessions.length > 0 && sessions.every((session) => selectedSessionIds.includes(session.id));

  return (
    <div className="admin-session-rows">
      <div className="admin-session-row is-head">
        <input
          type="checkbox"
          aria-label={t.selectAll}
          checked={allSelected}
          onChange={(event) => setSelectedSessionIds(event.target.checked ? sessions.map((session) => session.id) : [])}
        />
        <span>{t.date}</span>
        <span>{t.location}</span>
        <span>{t.status}</span>
        <span>{t.capacity}</span>
        <span />
      </div>
      {sessions.map((session) => {
        const venue = getVenue(session.venueId, venueList);
        const spots = availableSpots(session);
        const roster = rosterFor(session.id, bookings);
        const open = expanded === session.id;
        return (
          <div key={session.id} className={`admin-session-row${open ? ' is-open' : ''}`}>
            <input
              type="checkbox"
              aria-label={t.selectSession}
              checked={selectedSessionIds.includes(session.id)}
              onChange={(event) =>
                setSelectedSessionIds((current) =>
                  event.target.checked ? [...current, session.id] : current.filter((id) => id !== session.id),
                )
              }
            />
            <span className="admin-session-when">
              <strong>{formatDate(session.date, language)}</strong>
              <small>{session.startTime}–{session.endTime}</small>
            </span>
            <span className="admin-session-venue">{venue.name}</span>
            <span className="admin-session-status">
              <span className={`admin-status status-${session.status === 'published' ? 'confirmed' : 'draft'}`}>
                {session.status === 'published' ? t.published : t.draft}
              </span>
            </span>
            <span className="admin-session-capacity">
              {session.bookedSpots}/{session.capacity}
              <small>{session.markedFull ? t.markedFull : `${spots} ${t.spotsLeft}`}</small>
            </span>
            <span className="admin-session-actions">
              <Button variant="outline" size="sm" onClick={() => setExpanded(open ? null : session.id)} aria-expanded={open}>
                {c.roster} {roster.length ? `(${roster.reduce((sum, entry) => sum + entry.participantCount, 0)})` : ''}
                <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(session)} disabled={adminBusy}>
                <Pencil size={14} /> {t.edit}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={c.more} disabled={adminBusy} />}>
                  <Ellipsis size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onCreateRecurring(session)}>{t.createNextWeeks}</DropdownMenuItem>
                  {session.status === 'published' ? (
                    <DropdownMenuItem onClick={() => setQrSession(session)}>{t.qrCode}</DropdownMenuItem>
                  ) : null}
                  {session.markedFull ? (
                    <DropdownMenuItem onClick={() => onSetFull(session, false)}>{t.unmarkFull}</DropdownMenuItem>
                  ) : spots > 0 ? (
                    <DropdownMenuItem title={t.markFullHint} onClick={() => onSetFull(session, true)}>{t.markFull}</DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(session)}>{t.delete}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
            {open ? (
              <div className="admin-session-roster">
                <RosterList roster={roster} language={language} />
                {roster.length ? (
                  <CopyRosterButton
                    text={rosterText({ date: session.date, startTime: session.startTime, endTime: session.endTime, venueName: venue.name }, roster)}
                    language={language}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {qrSession ? (
        <QrCodeDialog
          url={`${siteOrigin()}/?view=detail&session=${encodeURIComponent(qrSession.id)}`}
          title={t.sessionQrTitle
            .replace('{venue}', getVenue(qrSession.venueId, venueList).name)
            .replace('{date}', qrSession.date)
            .replace('{time}', qrSession.startTime)}
          filename={`tennis-match-${qrSession.date}-${qrSession.startTime.replace(':', '')}`}
          label={t.qrCode}
          t={t}
          open
          onOpenChange={(value) => !value && setQrSession(null)}
        />
      ) : null}
    </div>
  );
}
