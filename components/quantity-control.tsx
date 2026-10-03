'use client';

import Minus from 'lucide-react/dist/esm/icons/minus.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';

export function QuantityControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="quantity-control" aria-label={label}>
      <button
        type="button"
        className="quantity-button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={16} strokeWidth={2.5} />
      </button>
      <span className="quantity-value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="quantity-button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
