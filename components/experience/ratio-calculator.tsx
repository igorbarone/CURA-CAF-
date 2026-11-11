"use client";
import { useState } from "react";
import {
  coffeeFor,
  formatNumber,
  formatRatio,
  waterFor,
} from "../../lib/experience/brew";

const presetLabels: Record<number, string> = {
  14: "mais concentrado",
  15: "equilibrado",
  16: "mais diluído",
  17: "ainda mais diluído",
};

/**
 * Real ratio calculator: Água (g) = Café (g) × Proporção. Editing the coffee
 * or the ratio recalculates the water; editing the water recalculates the
 * coffee. Values are kept as typed text so the fields never fight the user.
 */
export function RatioCalculator({
  initialCoffee = 20,
  initialRatio = 15,
  presets = [14, 15, 16, 17],
  beverage = false,
}: {
  initialCoffee?: number;
  initialRatio?: number;
  presets?: number[];
  beverage?: boolean;
}) {
  const [coffee, setCoffee] = useState(String(initialCoffee));
  const [ratio, setRatio] = useState(String(initialRatio));
  const [water, setWater] = useState(
    String(waterFor(initialCoffee, initialRatio)),
  );
  const parse = (value: string) => Number(value.replace(",", "."));
  const waterLabel = beverage ? "Bebida na xícara (g)" : "Água (g ou ml)";
  const valid = parse(coffee) > 0 && parse(ratio) > 0;
  return (
    <div className="xp-calc">
      <div className="xp-calc-fields">
        <label>
          <span>Café (g)</span>
          <input
            inputMode="decimal"
            value={coffee}
            onChange={(event) => {
              setCoffee(event.target.value);
              const value = waterFor(parse(event.target.value), parse(ratio));
              if (value) setWater(String(value));
            }}
          />
        </label>
        <span className="xp-calc-op mono" aria-hidden="true">
          ×
        </span>
        <label>
          <span>Proporção (1:x)</span>
          <input
            inputMode="decimal"
            value={ratio}
            onChange={(event) => {
              setRatio(event.target.value);
              const value = waterFor(parse(coffee), parse(event.target.value));
              if (value) setWater(String(value));
            }}
          />
        </label>
        <span className="xp-calc-op mono" aria-hidden="true">
          =
        </span>
        <label>
          <span>{waterLabel}</span>
          <input
            inputMode="decimal"
            value={water}
            onChange={(event) => {
              setWater(event.target.value);
              const value = coffeeFor(parse(event.target.value), parse(ratio));
              if (value) setCoffee(String(value));
            }}
          />
        </label>
      </div>
      <div className="xp-presets" role="group" aria-label="Proporções prontas">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={parse(ratio) === preset}
            onClick={() => {
              setRatio(String(preset));
              const value = waterFor(parse(coffee), preset);
              if (value) setWater(String(value));
            }}
          >
            <span className="mono">{formatRatio(preset)}</span>
            {presetLabels[preset] && !beverage && (
              <span>{presetLabels[preset]}</span>
            )}
          </button>
        ))}
      </div>
      <p className="xp-calc-result" aria-live="polite">
        {valid ? (
          <>
            <strong>
              {formatNumber(parse(coffee))} g de café ×{" "}
              {formatNumber(parse(ratio))} = {formatNumber(parse(water))} g{" "}
              {beverage ? "de bebida" : "de água"}
            </strong>{" "}
            <span className="mono">({formatRatio(parse(ratio))})</span>
          </>
        ) : (
          "Informe a quantidade de café e a proporção."
        )}
      </p>
      <p className="xp-small">
        Fórmula: {beverage ? "Bebida" : "Água"} (g) = Café (g) × Proporção. A
        percepção final também depende da extração e do método: moagem, tempo e
        temperatura mudam o resultado mesmo com a mesma proporção.
      </p>
    </div>
  );
}
