// Brewing maths for the Laboratório de Preparo. Pure and deterministic: the
// calculator, recipes and timer never depend on AI or on the network.
//
// Water (g) = Coffee (g) × Ratio. For espresso the ratio compares the dose with
// the beverage in the cup (yield), so the same formula gives the yield.
import type { BrewMethod, Strength } from "./schema";
import type { ExperienceCoffee } from "./coffee";

export const roundCoffee = (grams: number) => Math.round(grams * 2) / 2;
export const roundWater = (grams: number) => Math.round(grams);

export function waterFor(coffeeGrams: number, ratio: number) {
  if (!(coffeeGrams > 0) || !(ratio > 0)) return 0;
  return roundWater(coffeeGrams * ratio);
}
export function coffeeFor(waterGrams: number, ratio: number) {
  if (!(waterGrams > 0) || !(ratio > 0)) return 0;
  return roundCoffee(waterGrams / ratio);
}
export function ratioFor(coffeeGrams: number, waterGrams: number) {
  if (!(coffeeGrams > 0) || !(waterGrams > 0)) return 0;
  return Math.round((waterGrams / coffeeGrams) * 10) / 10;
}

export const formatNumber = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const formatRatio = (ratio: number) => `1:${formatNumber(ratio)}`;
export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = String(safe % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

export type RecipeInput =
  | { mode: "cups"; amount: number }
  | { mode: "coffee"; amount: number }
  | { mode: "water"; amount: number };

export type TimedStep = {
  at: number;
  title: string;
  text: string;
  /** Cumulative water on the scale when this pour ends, in grams. */
  targetGrams?: number;
};
export type Recipe = {
  methodId: string;
  strength: Strength;
  ratio: number;
  coffeeGrams: number;
  /** Brewing water, or beverage yield for espresso (see ratioMeaning). */
  waterGrams: number;
  ratioMeaning: BrewMethod["ratioMeaning"];
  bloomGrams: number | null;
  cups: number;
  steps: { title: string; text: string; at?: number; targetGrams?: number }[];
  schedule: TimedStep[];
  totalSeconds: number | null;
  warnings: string[];
};

function fill(template: string, values: Record<string, number | null>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? match : formatNumber(value);
  });
}

export function generateRecipe(
  method: BrewMethod,
  input: RecipeInput,
  strength: Strength = "equilibrado",
): Recipe {
  const ratio = method.ratio[strength];
  const amount = Number.isFinite(input.amount) ? Math.max(0, input.amount) : 0;
  let coffeeGrams: number;
  let waterGrams: number;
  if (input.mode === "coffee") {
    coffeeGrams = roundCoffee(amount);
    waterGrams = waterFor(coffeeGrams, ratio);
  } else if (input.mode === "water") {
    waterGrams = roundWater(amount);
    coffeeGrams = coffeeFor(waterGrams, ratio);
  } else if (method.cupIsDose) {
    coffeeGrams = roundCoffee(amount * method.cup.grams);
    waterGrams = waterFor(coffeeGrams, ratio);
  } else {
    waterGrams = roundWater(amount * method.cup.grams);
    coffeeGrams = coffeeFor(waterGrams, ratio);
  }
  const cups = method.cupIsDose
    ? Math.round((coffeeGrams / method.cup.grams) * 10) / 10
    : Math.round((waterGrams / method.cup.grams) * 10) / 10;
  const bloomGrams =
    method.bloomFactor && coffeeGrams > 0
      ? Math.min(roundWater(coffeeGrams * method.bloomFactor), waterGrams)
      : null;
  const warnings: string[] = [];
  if (method.maxWaterGrams && waterGrams > method.maxWaterGrams)
    warnings.push(
      `Essa quantidade passa de ${formatNumber(method.maxWaterGrams)} g de água, mais do que a maioria dos equipamentos desse tipo comporta. Considere preparar em duas etapas.`,
    );
  if (coffeeGrams > 0 && coffeeGrams < 5 && method.ratioMeaning === "water")
    warnings.push(
      "Com menos de 5 g de café a extração fica difícil de controlar. Prefira preparar pelo menos uma xícara cheia.",
    );
  const targetFor = (step: BrewMethod["steps"][number]) =>
    step.pour?.type === "bloom"
      ? (bloomGrams ?? undefined)
      : step.pour?.type === "fraction"
        ? roundWater(waterGrams * step.pour.value)
        : undefined;
  const values = {
    coffee: coffeeGrams,
    water: waterGrams,
    yield: waterGrams,
    bloom: bloomGrams,
  };
  const steps = method.steps.map((step) => {
    const targetGrams = targetFor(step);
    return {
      title: step.title,
      text: fill(step.text, { ...values, target: targetGrams ?? null }),
      at: step.at,
      targetGrams,
    };
  });
  const schedule = method.timer
    ? steps
        .filter(
          (step): step is typeof step & { at: number } => step.at !== undefined,
        )
        .map(({ at, title, text, targetGrams }) => ({
          at,
          title,
          text,
          targetGrams,
        }))
    : [];
  const lastAt = schedule.length ? schedule[schedule.length - 1].at : 0;
  return {
    methodId: method.id,
    strength,
    ratio,
    coffeeGrams,
    waterGrams,
    ratioMeaning: method.ratioMeaning,
    bloomGrams,
    cups,
    steps,
    schedule,
    totalSeconds: method.timer
      ? Math.max(method.time.seconds[1], lastAt)
      : null,
    warnings,
  };
}

/** Where the timer stands at a given elapsed second. */
export function timerPosition(schedule: TimedStep[], elapsed: number) {
  let current = -1;
  for (let i = 0; i < schedule.length; i++)
    if (schedule[i].at <= elapsed) current = i;
  const next = schedule[current + 1];
  return {
    current,
    step: current >= 0 ? schedule[current] : undefined,
    next,
    secondsToNext: next ? next.at - elapsed : null,
  };
}

/**
 * Whether the label suggests this method for the coffee. "experiment" means
 * the method is not on the label: still possible, presented as exploration.
 */
export function methodFit(method: BrewMethod, coffee?: ExperienceCoffee) {
  if (!coffee || !coffee.preparations.length) return "unknown" as const;
  return method.catalogPreparations.some((preparation) =>
    coffee.preparations.includes(preparation),
  )
    ? ("label" as const)
    : ("experiment" as const);
}
