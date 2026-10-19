'use client';

import { useState, type ChangeEvent, type RefObject } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Upload from 'lucide-react/dist/esm/icons/upload.mjs';

import { QrCodeDialog, siteOrigin } from '@/components/qr-code-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Translations } from '@/lib/translations';
import type { Language } from '@/types/tennis';

/**
 * Session list actions in three groups: create (add, import), view (list or
 * week, expired), and a "More" menu for export, template, site QR and undo.
 */
export function AdminSessionToolbar({
  language,
  t,
  adminBusy,
  sessionView,
  setSessionView,
  showExpiredSessions,
  setShowExpiredSessions,
  canUndo,
  importInput,
  onAdd,
  onImport,
  onExport,
  onUndo,
}: {
  language: Language;
  t: Translations;
  adminBusy: boolean;
  sessionView: 'list' | 'week';
  setSessionView: (view: 'list' | 'week') => void;
  showExpiredSessions: boolean;
  setShowExpiredSessions: (show: boolean | ((prev: boolean) => boolean)) => void;
  canUndo: boolean;
  importInput: RefObject<HTMLInputElement | null>;
  onAdd: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onUndo: () => void;
}) {
  const [siteQrOpen, setSiteQrOpen] = useState(false);
  return (
    <div className="admin-toolbar">
      <div className="admin-toolbar-group">
        <Button size="sm" onClick={onAdd} disabled={adminBusy}>
          <Plus size={14} /> {t.addSession}
        </Button>
        <Button variant="outline" size="sm" onClick={() => importInput.current?.click()} disabled={adminBusy}>
          <Upload size={14} /> {adminBusy ? t.importingSessions : t.importSessions}
        </Button>
        <input
          ref={importInput}
          className="sr-only"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label={t.importSessions}
          onChange={onImport}
        />
      </div>
      <div className="admin-toolbar-group">
        <div className="admin-segmented" role="group">
          <button type="button" aria-pressed={sessionView === 'list'} onClick={() => setSessionView('list')}>
            {t.sessionTableView}
          </button>
          <button type="button" aria-pressed={sessionView === 'week'} onClick={() => setSessionView('week')}>
            {t.sessionCalendarView}
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowExpiredSessions((current) => !current)} disabled={adminBusy}>
          {showExpiredSessions ? t.hideExpiredSessions : t.viewExpiredSessions}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            {language === 'zh' ? '更多' : 'More'} <ChevronDown size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport}>{t.exportSessions}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.location.assign('/session-import-template.xlsx')}>{t.downloadSessionTemplate}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSiteQrOpen(true)}>{t.siteQrCode}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canUndo || adminBusy} onClick={onUndo}>{t.undo}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <QrCodeDialog
        url={siteOrigin()}
        title={t.siteQrTitle}
        filename="tennis-match-qr"
        label={t.siteQrCode}
        t={t}
        open={siteQrOpen}
        onOpenChange={setSiteQrOpen}
      />
    </div>
  );
}
