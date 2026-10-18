'use client';
import { PREFERRED_SLOTS, SLOT_LABELS } from '@/lib/partner-request-slots';
import type { Language } from '@/types/tennis';
export type ContactFields = {
  phone: string;
  wechat?: string;
  whatsapp?: string;
  preferredContact?: 'email' | 'phone' | 'wechat' | 'whatsapp';
};
export function PartnerContactFields({
  value,
  onChange,
  labels,
}: {
  value: ContactFields;
  onChange: (value: ContactFields) => void;
  labels: {
    phone: string;
    wechat: string;
    whatsapp: string;
    email: string;
    preferredContact: string;
    contactPrivacyNote: string;
  };
}) {
  return (
    <>
      {(['wechat', 'whatsapp'] as const).map((key) => (
        <label className="field cs-pr-field" key={key}>
          <span>
            {labels[key]}
            {value.preferredContact === key ? ' *' : ''}
          </span>
          <input
            className="native-input"
            required={value.preferredContact === key}
            maxLength={key === 'wechat' ? 40 : 50}
            value={value[key] ?? ''}
            onChange={(event) =>
              onChange({ ...value, [key]: event.target.value })
            }
          />
        </label>
      ))}
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
              {labels[key]}
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
