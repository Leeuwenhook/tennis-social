'use client';

import { useEffect, useState } from 'react';
import QrCode from 'lucide-react/dist/esm/icons/qr-code.mjs';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Translations } from '@/lib/translations';

/** The origin admins are on, so production posters point at the live site. */
export function siteOrigin() {
  return typeof window === 'undefined' ? 'https://www.tennismatch.space' : window.location.origin;
}

function download(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

/** A button that opens a printable QR code for `url`, with PNG and SVG downloads. */
export function QrCodeDialog({
  url,
  title,
  filename,
  label,
  t,
  disabled,
}: {
  url: string;
  title: string;
  filename: string;
  label: string;
  t: Translations;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(url, { width: 512, margin: 2 }).then((dataUrl) => {
        if (!cancelled) setPreview(dataUrl);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  async function downloadPng() {
    const { default: QRCode } = await import('qrcode');
    download(await QRCode.toDataURL(url, { width: 1024, margin: 2 }), `${filename}.png`);
  }

  async function downloadSvg() {
    const { default: QRCode } = await import('qrcode');
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2 });
    const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    download(href, `${filename}.svg`);
    URL.revokeObjectURL(href);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <QrCode size={14} /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{t.qrCodeIntro}</DialogDescription>
          </DialogHeader>
          {preview ? (
            <img className="qr-preview" src={preview} alt={title} width={256} height={256} />
          ) : (
            <div className="qr-preview" aria-hidden="true" />
          )}
          <p className="qr-url">{url}</p>
          <div className="admin-row-actions">
            <Button size="sm" onClick={() => void downloadPng()}>{t.downloadPng}</Button>
            <Button variant="outline" size="sm" onClick={() => void downloadSvg()}>{t.downloadSvg}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
