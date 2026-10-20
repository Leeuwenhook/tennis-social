'use client';

import Check from 'lucide-react/dist/esm/icons/check.mjs';
import Pencil from 'lucide-react/dist/esm/icons/pencil.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.mjs';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatMoney,
} from '@/lib/formatters';
import { emptyVenueDraft } from '@/lib/tennis-utils';
import type {
} from '@/types/tennis';

import type { AdminViewProps } from '@/components/admin/admin-view';

export function AdminVenuesTab(props: AdminViewProps) {
  const {
  venueList,
  adminBusy,
  adminMessage,
  venueEditorOpen,
  setVenueEditorOpen,
  venueDraft,
  setVenueDraft,
  language,
  t,
  onSaveVenue,
  onChooseVenueImage,
  onReuseVenuePhoto,
  onStartEditVenue,
  onDeleteVenue,
  } = props;

  function renderVenueEditor() {
    return (
      <form className="admin-editor venue-editor" onSubmit={onSaveVenue}>
        <div className="admin-editor-heading">
          <div>
            <p className="eyebrow muted">{venueDraft.id ? t.editVenue : t.addVenue}</p>
            <h2>{venueDraft.id ? t.editVenue : t.addVenue}</h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setVenueEditorOpen(false);
              setVenueDraft(emptyVenueDraft(venueList));
            }}
          >
            {t.cancelEdit}
          </button>
        </div>
        <div className="form-grid two-col">
          <div className="field">
            <Label htmlFor="venue-name">
              {t.venueName} <em>*</em>
            </Label>
            <Input
              id="venue-name"
              value={venueDraft.name}
              onChange={(event) => setVenueDraft((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="field">
            <Label htmlFor="venue-area">
              {t.area} <em>*</em>
            </Label>
            <Input
              id="venue-area"
              value={venueDraft.area}
              onChange={(event) => setVenueDraft((current) => ({ ...current, area: event.target.value }))}
            />
          </div>
          <div className="field">
            <Label htmlFor="venue-description">Venue description (English)</Label>
            <textarea id="venue-description" className="native-textarea" rows={3} maxLength={2000}
              placeholder="留空自动生成 / Leave empty to auto-generate"
              value={venueDraft.description}
              onChange={(event) => setVenueDraft((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="venue-descriptionZh">场地介绍（中文）</Label>
            <textarea id="venue-descriptionZh" className="native-textarea" rows={3} maxLength={2000}
              placeholder="留空自动生成 / Leave empty to auto-generate"
              value={venueDraft.descriptionZh}
              onChange={(event) => setVenueDraft((current) => ({ ...current, descriptionZh: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="venue-address">{language === 'zh' ? '详细地址' : 'Street address'}</Label>
            <Input id="venue-address" value={venueDraft.address} onChange={(event) => setVenueDraft((current) => ({ ...current, address: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="venue-postcode">{t.postcode}</Label>
            <Input id="venue-postcode" value={venueDraft.postcode} onChange={(event) => setVenueDraft((current) => ({ ...current, postcode: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="venue-address-zh">{language === 'zh' ? '中文地址' : 'Chinese address'}</Label>
            <Input id="venue-address-zh" value={venueDraft.addressZh} onChange={(event) => setVenueDraft((current) => ({ ...current, addressZh: event.target.value }))} />
          </div>
          <div className="field">
            <Label htmlFor="venue-peak-price">
              {t.peakPrice} <em>*</em>
            </Label>
            <div className="input-prefix">
              <span>£</span>
              <Input
                id="venue-peak-price"
                inputMode="decimal"
                value={venueDraft.peakPrice}
                onChange={(event) =>
                  setVenueDraft((current) => ({ ...current, peakPrice: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="field">
            <Label htmlFor="venue-off-peak-price">
              {t.offPeakPrice} <em>*</em>
            </Label>
            <div className="input-prefix">
              <span>£</span>
              <Input
                id="venue-off-peak-price"
                inputMode="decimal"
                value={venueDraft.offPeakPrice}
                onChange={(event) =>
                  setVenueDraft((current) => ({ ...current, offPeakPrice: event.target.value }))
                }
              />
            </div>
          </div>
        </div>
        <div className="field venue-image-field">
          <Label htmlFor="venue-photo">
            {t.venueImage} <em>*</em>
          </Label>
          <Input
            id="venue-photo"
            type="text"
            value={venueDraft.photo.startsWith('data:') ? '' : venueDraft.photo}
            placeholder={t.imageUrl}
            onChange={(event) =>
              setVenueDraft((current) => ({
                ...current,
                photo: event.target.value,
                photos: event.target.value.trim()
                  ? [event.target.value.trim(), ...current.photos.slice(1)]
                  : current.photos,
                notes: current.notes.replace(/\s*[（(]复用照片[）)]\s*/g, '').trim(),
              }))
            }
          />
          <div className="venue-upload-row">
            <Input
              id="venue-photo-file"
              type="file"
              accept="image/*"
              multiple
              aria-label={t.replaceImage}
              onChange={onChooseVenueImage}
            />
            <span>
              {t.replaceImage} · {t.uploadImage}
            </span>
          </div>
          <div className="venue-image-actions">
            {venueDraft.photos.map((photo, index) => (
              <div className="venue-photo-item" key={`${photo.slice(0, 30)}-${index}`}>
                <img src={photo} alt={`${venueDraft.name || t.venueImage} ${index + 1}`} />
                <a
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  href={photo}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.viewImage}
                </a>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    setVenueDraft((current) => {
                      const photos = current.photos.filter((_, itemIndex) => itemIndex !== index);
                      return { ...current, photos, photo: photos[0] ?? '' };
                    })
                  }
                >
                  {t.removeImage}
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={onReuseVenuePhoto}>
              {t.reuseImage}
            </Button>
          </div>
          <p className="admin-field-note">{t.imageHelp}</p>
        </div>
        <div className="field">
          <Label htmlFor="venue-notes">{t.venueNotes}</Label>
          <textarea
            id="venue-notes"
            value={venueDraft.notes}
            onChange={(event) => setVenueDraft((current) => ({ ...current, notes: event.target.value }))}
            className="native-textarea"
            rows={2}
            placeholder={t.venueNotes}
          />
        </div>
        {adminMessage ? (
          <div className="admin-message">
            <Check size={15} /> {adminMessage}
          </div>
        ) : null}
        <Button type="submit" disabled={adminBusy}>
          <Check size={16} /> {adminBusy ? t.saving : t.saveVenue}
        </Button>
      </form>
    );
  }

  return (
            <div className={`admin-venue-layout${venueEditorOpen ? '' : ' venue-layout-full'}`}>
              <div className="admin-venue-list">
                <div className="admin-list-heading">
                  <div>
                    <p className="eyebrow muted">{t.manageVenues}</p>
                    <h2>{t.venueList}</h2>
                    <p>{t.venueListIntro}</p>
                  </div>
                  <div className="admin-list-heading-actions">
                    <Badge variant="secondary">{venueList.length}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVenueDraft(emptyVenueDraft(venueList));
                        setVenueEditorOpen(true);
                      }}
                      disabled={adminBusy}
                    >
                      <Plus size={14} /> {t.addVenue}
                    </Button>
                  </div>
                </div>
                {venueList.map((venue) => (
                  <div className="admin-venue-row" key={venue.id}>
                    <a
                      className="admin-venue-photo-link"
                      href={venue.photo}
                      target="_blank"
                      rel="noreferrer"
                      title={t.viewImage}
                    >
                      <img src={venue.photo} alt={venue.name} />
                    </a>
                    <div className="admin-venue-row-main">
                      <strong>{venue.name}</strong>
                      <span>{venue.area}</span>
                      <small>
                        {t.peakPrice}: {formatMoney(venue.peakPricePence, language)} · {t.offPeakPrice}:{' '}
                        {formatMoney(venue.offPeakPricePence, language)}
                      </small>
                      {venue.notes ? <small className="admin-venue-note">{venue.notes}</small> : null}
                    </div>
                    <div className="admin-row-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onStartEditVenue(venue)}
                        disabled={adminBusy}
                      >
                        <Pencil size={14} /> {t.edit}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeleteVenue(venue)}
                        disabled={adminBusy}
                      >
                        <Trash2 size={14} /> {t.delete}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {venueEditorOpen ? renderVenueEditor() : null}
            </div>
  );
}
