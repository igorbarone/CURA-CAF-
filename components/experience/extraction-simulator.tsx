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
  const sliders: {
    key: keyof ExtractionInput;
    label: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    value: string;
    help: string;
  }[] = [
    {
      key: "grind",
      label: "Moagem",
      unit: "de 1 (muito fina) a 5 (muito grossa)",
      min: 1,
      max: 5,
      step: 1,
      value: grindLabels[input.grind],
      help: "Mais fina extrai mais rápido.",
    },
    {
      key: "temperature",
      label: "Temperatura da água",
      unit: "graus Celsius",
      min: 80,
      max: 100,
      step: 1,
      value: `${input.temperature} °C`,
      help: "Mais quente extrai mais.",
    },
    {
      key: "seconds",
      label: "Tempo de contato",
      unit: "minutos e segundos",
      min: 60,
      max: 360,
      step: 15,
      value: formatClock(input.seconds),
      help: "Mais tempo extrai mais.",
    },
    {
      key: "ratio",
      label: "Proporção café/água",
      unit: "gramas de água por grama de café",
      min: 12,
      max: 20,
      step: 0.5,
      value: `1:${formatNumber(input.ratio)}`,
      help: "Mais água dilui a bebida.",
    },
  ];
  return (
    <div className="xp-sim">
      <div className="xp-sim-controls">
        {sliders.map((slider) => (
          <div key={slider.key} className="xp-range">
            <label htmlFor={`sim-${slider.key}`}>
              {slider.label}{" "}
              <output htmlFor={`sim-${slider.key}`} className="mono">
                {slider.value}
              </output>
            </label>
            <input
              id={`sim-${slider.key}`}
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={input[slider.key]}
              onChange={set(slider.key)}
              aria-valuetext={`${slider.value} (${slider.unit})`}
              aria-describedby={`sim-${slider.key}-help`}
            />
            <span id={`sim-${slider.key}-help`} className="xp-small">
              {slider.help} Escala: {slider.unit}.
            </span>
          </div>
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
          aria-label={`Gráfico: rendimento de extração estimado ${Math.round(result.extraction)}%, concentração ${formatNumber(Math.round(result.strength * 20) / 20)}%`}
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
            Rendimento de extração ≈ {Math.round(result.extraction)}% ·
            Concentração (TDS) ≈{" "}
            {formatNumber(Math.round(result.strength * 20) / 20)}%
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
