"use client";
import { useState } from "react";
import {
  coffeeFor,
  formatNumber,
  formatRatio,
  parseAmount,
  waterFor,
} from "../../lib/experience/brew";

const presetLabels: Record<number, string> = {
  14: "mais concentrado",
  15: "equilibrado",
  16: "mais diluído",
  17: "ainda mais diluído",
};

/**
 * Ratio calculator on the recipe engine's own primitives: Água (g) = Café (g)
 * × Proporção, with the same rounding (coffee 0,5 g, water 1 g). Editing the
 * coffee or the ratio recalculates the water; editing the water recalculates
 * the coffee. An invalid entry clears the derived value instead of keeping a
 * stale one. Seeded with the current recipe, so both show the same numbers.
 */
export function RatioCalculator({
  initialCoffee,
  initialRatio,
  initialWater,
  presets,
  beverage = false,
}: {
  initialCoffee: number;
  initialRatio: number;
  initialWater: number;
  presets: number[];
  beverage?: boolean;
}) {
  const [coffee, setCoffee] = useState(formatNumber(initialCoffee));
  const [ratio, setRatio] = useState(formatNumber(initialRatio));
  const [water, setWater] = useState(String(initialWater));
  const [error, setError] = useState("");
  const c = parseAmount(coffee);
  const r = parseAmount(ratio);
  const w = parseAmount(water);
  const waterLabel = beverage ? "Bebida (g)" : "Água (g ou ml)";
  const fromCoffee = (nextCoffee: string, nextRatio: string) => {
    const value = waterFor(parseAmount(nextCoffee), parseAmount(nextRatio));
    setWater(value ? String(value) : "");
    setError(
      value
        ? ""
        : "Informe café e proporção maiores que zero (use vírgula ou ponto).",
    );
  };
  return (
    <div className="xp-calc">
      <div className="xp-calc-fields">
        <label>
          <span>Café (g)</span>
          <input
            inputMode="decimal"
            value={coffee}
            aria-invalid={!(c > 0)}
            onChange={(event) => {
              setCoffee(event.target.value);
              fromCoffee(event.target.value, ratio);
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
            aria-invalid={!(r > 0)}
            onChange={(event) => {
              setRatio(event.target.value);
              fromCoffee(coffee, event.target.value);
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
            aria-invalid={!(w > 0)}
            onChange={(event) => {
              setWater(event.target.value);
              const value = coffeeFor(parseAmount(event.target.value), r);
              setCoffee(value ? formatNumber(value) : "");
              setError(
                value ? "" : "Informe água e proporção maiores que zero.",
              );
            }}
          />
        </label>
      </div>
      <div className="xp-presets" role="group" aria-label="Proporções prontas">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={r === preset}
            onClick={() => {
              setRatio(formatNumber(preset));
              fromCoffee(coffee, String(preset));
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
        {c > 0 && r > 0 && w > 0 && !error ? (
          <>
            <strong>
              {formatNumber(c)} g × {formatNumber(r)} ≈ {formatNumber(w)} g{" "}
              {beverage ? "de bebida" : "de água"}
            </strong>{" "}
            <span className="mono">
              (proporção efetiva {formatRatio(Math.round((w / c) * 10) / 10)})
            </span>
          </>
        ) : (
          <span className="xp-calc-error">
            {error || "Informe a quantidade de café e a proporção."}
          </span>
        )}
      </p>
      <p className="xp-small">
        Fórmula: {beverage ? "Bebida" : "Água"} (g) = Café (g) × Proporção. O
        café é arredondado para 0,5 g e a água para 1 g, como na receita. A
        percepção final também depende da extração: moagem, tempo e temperatura
        mudam o resultado mesmo com a mesma proporção.
      </p>
    </div>
  );
}
