"use client";
// "Quantidade de SAMBA" → "quantidade de SAMBA": names keep their case.
const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);
export function QuantityInput({
  id,
  label,
  value,
  max,
  onChange,
  hideLabel = false,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="quantity-input">
      <label htmlFor={id} className={hideLabel ? "visually-hidden" : undefined}>
        {label}
      </label>
      <div>
        <button
          type="button"
          aria-label={`Diminuir ${lowerFirst(label)}`}
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Math.trunc(Number(event.target.value));
            if (Number.isFinite(next))
              onChange(Math.min(Math.max(next, 1), max));
          }}
        />
        <button
          type="button"
          aria-label={`Aumentar ${lowerFirst(label)}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
