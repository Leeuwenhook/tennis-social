'use client';
import { PREFERRED_SLOTS, SLOT_LABELS } from '@/lib/partner-request-slots';
import type { Language } from '@/types/tennis';
export type ContactFields = {
  phone: string;
  wechat?: string;
  whatsapp?: string;
  preferredContact?: 'email' | 'phone' | 'wechat' | 'whatsapp';
};
/** Shows a legacy WeChat/WhatsApp value in the combined field until the player types a new one. */
export function contactHandleValue(value: ContactFields) {
  if (value.phone) return value.phone;
  const preferred = value.preferredContact === 'wechat' ? value.wechat : value.preferredContact === 'whatsapp' ? value.whatsapp : '';
  return preferred || value.wechat || value.whatsapp || '';
}

/** The single phone/WeChat/WhatsApp field is required unless the player prefers email. */
export function contactHandleRequired(preferredContact: ContactFields['preferredContact']) {
  return (preferredContact ?? 'email') !== 'email';
}

export function PartnerContactFields({
  value,
  onChange,
  labels,
}: {
  value: ContactFields;
  onChange: (value: ContactFields) => void;
  labels: {
    contactSms: string;
    wechat: string;
    whatsapp: string;
    email: string;
    preferredContact: string;
    contactPrivacyNote: string;
  };
}) {
  const optionLabels = { email: labels.email, phone: labels.contactSms, wechat: labels.wechat, whatsapp: labels.whatsapp };
  return (
    <>
      <label className="field cs-pr-field">
        <span>{labels.preferredContact}</span>
        <select
          className="native-select"
          value={value.preferredContact ?? 'email'}
          onChange={(event) =>
            onChange({
              ...value,
              preferredContact: event.target
                .value as ContactFields['preferredContact'],
            })
          }
        >
          {(['email', 'phone', 'wechat', 'whatsapp'] as const).map((key) => (
            <option key={key} value={key}>
              {optionLabels[key]}
            </option>
          ))}
        </select>
      </label>
      <p className="field-hint">{labels.contactPrivacyNote}</p>
    </>
  );
}
export function PartnerSlotFields({
  value = [],
  onChange,
  language,
  label,
}: {
  value?: string[];
  onChange: (slots: string[]) => void;
  language: Language;
  label: string;
}) {
  return (
    <fieldset className="field">
      <legend>{label} *</legend>
      <div className="level-picker">
        {PREFERRED_SLOTS.map((slot) => (
          <button
            type="button"
            key={slot}
            className={
              value.includes(slot) ? 'level-chip selected' : 'level-chip'
            }
            aria-pressed={value.includes(slot)}
            onClick={() =>
              onChange(
                value.includes(slot)
                  ? value.filter((item) => item !== slot)
                  : [...value, slot],
              )
            }
          >
            {SLOT_LABELS[language][slot]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
