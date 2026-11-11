// Educational extraction model for the "Ciência do café" simulator.
//
// It is a deliberately simplified, monotonic model: it shows *directions*
// (finer grind, hotter water and longer contact extract more; more water per
// gram dilutes), not laboratory values. Reference ranges follow the classic
// brewing control chart for filter coffee: extraction 18–22 % and
// strength (TDS) 1.15–1.45 %. Absorbed water is assumed to be 2 g per g.
export type ExtractionInput = {
  /** 1 = muito fina … 5 = muito grossa (3 = média). */
  grind: number;
  temperature: number;
  seconds: number;
  ratio: number;
};
export const EXTRACTION_IDEAL = { min: 18, max: 22 } as const;
export const STRENGTH_IDEAL = { min: 1.15, max: 1.45 } as const;
export const extractionDefaults: ExtractionInput = {
  grind: 3,
  temperature: 93,
  seconds: 180,
  ratio: 16,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function simulateExtraction(input: ExtractionInput) {
  const grind = clamp(input.grind, 1, 5);
  const temperature = clamp(input.temperature, 80, 100);
  const seconds = clamp(input.seconds, 30, 480);
  const ratio = clamp(input.ratio, 10, 22);
  const extraction = clamp(
    20 +
      (3 - grind) * 1.6 +
      (temperature - 93) * 0.25 +
      Math.log2(seconds / 180) * 2.2,
    10,
    30,
  );
  const strength = extraction / (ratio - 2);
  const extractionLevel =
    extraction < EXTRACTION_IDEAL.min
      ? "sub"
      : extraction > EXTRACTION_IDEAL.max
        ? "super"
        : "ideal";
  const strengthLevel =
    strength < STRENGTH_IDEAL.min
      ? "fraco"
      : strength > STRENGTH_IDEAL.max
        ? "forte"
        : "equilibrado";
  return {
    extraction: Math.round(extraction * 10) / 10,
    strength: Math.round(strength * 100) / 100,
    extractionLevel,
    strengthLevel,
  } as const;
}
export type ExtractionResult = ReturnType<typeof simulateExtraction>;

export const extractionCopy = {
  sub: "Subextração: a água tirou pouco do café. Tende a ficar azedo, ralo e com final curto.",
  ideal:
    "Extração equilibrada: tende a trazer doçura, acidez agradável e boa finalização.",
  super:
    "Superextração: a água avançou nos compostos mais amargos. Tende a ficar amargo e a secar a boca.",
  fraco: "Concentração baixa: a bebida tende a parecer aguada.",
  equilibrado: "Concentração equilibrada para um coado.",
  forte:
    "Concentração alta: a bebida tende a parecer pesada ou intensa demais.",
} as const;
