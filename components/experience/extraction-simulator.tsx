"use client";
import { useState } from "react";
import {
  EXTRACTION_IDEAL,
  STRENGTH_IDEAL,
  extractionCopy,
  extractionDefaults,
  simulateExtraction,
  type ExtractionInput,
} from "../../lib/experience/extraction";
import { formatClock, formatNumber } from "../../lib/experience/brew";

const grindLabels = [
  "",
  "Muito fina",
  "Fina",
  "Média",
  "Grossa",
  "Muito grossa",
];
// Chart window (extraction %, strength %).
const X = [14, 26] as const;
const Y = [0.8, 1.9] as const;
const px = (value: number) => ((value - X[0]) / (X[1] - X[0])) * 100;
const py = (value: number) => 100 - ((value - Y[0]) / (Y[1] - Y[0])) * 100;

export function ExtractionSimulator() {
  const [input, setInput] = useState<ExtractionInput>(extractionDefaults);
  const result = simulateExtraction(input);
  const set =
    (key: keyof ExtractionInput) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setInput((current) => ({
        ...current,
        [key]: Number(event.target.value),
      }));
  const sliders: [
    keyof ExtractionInput,
    string,
    number,
    number,
    number,
    string,
  ][] = [
    ["grind", "Moagem", 1, 5, 1, grindLabels[input.grind]],
    [
      "temperature",
      "Temperatura da água",
      80,
      100,
      1,
      `${input.temperature} °C`,
    ],
    ["seconds", "Tempo de contato", 60, 360, 15, formatClock(input.seconds)],
    [
      "ratio",
      "Proporção café/água",
      12,
      20,
      0.5,
      `1:${formatNumber(input.ratio)}`,
    ],
  ];
  return (
    <div className="xp-sim">
      <div className="xp-sim-controls">
        {sliders.map(([key, label, min, max, step, value]) => (
          <label key={key} className="xp-range">
            <span>
              {label} <output className="mono">{value}</output>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={input[key]}
              onChange={set(key)}
              aria-valuetext={value}
            />
          </label>
        ))}
        <button
          type="button"
          className="xp-text-link"
          onClick={() => setInput(extractionDefaults)}
        >
          Voltar ao ponto de partida
        </button>
      </div>
      <div className="xp-sim-output">
        <div
          className="xp-chart"
          role="img"
          aria-label={`Extração estimada ${formatNumber(result.extraction)}%, concentração ${formatNumber(result.strength)}%`}
        >
          <span
            className="xp-chart-ideal"
            style={{
              left: `${px(EXTRACTION_IDEAL.min)}%`,
              width: `${px(EXTRACTION_IDEAL.max) - px(EXTRACTION_IDEAL.min)}%`,
              top: `${py(STRENGTH_IDEAL.max)}%`,
              height: `${py(STRENGTH_IDEAL.min) - py(STRENGTH_IDEAL.max)}%`,
            }}
          />
          <span
            className="xp-chart-dot"
            style={{
              left: `${Math.min(100, Math.max(0, px(result.extraction)))}%`,
              top: `${Math.min(100, Math.max(0, py(result.strength)))}%`,
            }}
          />
          <span className="xp-chart-x mono">Extração →</span>
          <span className="xp-chart-y mono">Concentração →</span>
          <span className="xp-chart-label mono">faixa de referência</span>
        </div>
        <div aria-live="polite">
          <p className="xp-sim-numbers mono">
            Extração ≈ {formatNumber(result.extraction)}% · Concentração ≈{" "}
            {formatNumber(result.strength)}%
          </p>
          <p>{extractionCopy[result.extractionLevel]}</p>
          <p>{extractionCopy[result.strengthLevel]}</p>
        </div>
        <p className="xp-small">
          Modelo educativo simplificado para mostrar tendências. Os valores
          reais dependem do café, do método, do moedor e da água. Use o paladar
          como guia final.
        </p>
      </div>
    </div>
  );
}
