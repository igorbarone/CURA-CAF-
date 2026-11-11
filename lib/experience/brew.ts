// Recipe engine — the single source of truth for every number the CURA
// Experience shows: recipe card, calculator, step-by-step, timer, journal,
// favourites and the Barista (local and AI). Pure and deterministic.
//
// Units and rounding policy (docs/EXPERIENCIA.md § Receitas):
// - Coffee is rounded to 0.5 g (what a kitchen scale shows comfortably).
// - Water and beverage are rounded to 1 g (≈ 1 ml).
// - A value the person typed is kept exactly; only derived values round, and
//   the recipe flags the approximation and the effective ratio.
// - "Water" is brewing water. Coffee grounds retain about 2 g of water per
//   gram, so the cup holds less than was poured (estimated beverage).
// - For espresso the ratio compares the dose with the beverage in the cup
//   (yield). Each drink is one extraction with one basket dose.
// - Equipment capacity splits large requests into complete rounds; a round
//   never asks for more water than the configured capacity.
import type { ExperienceCoffee } from "./coffee";
import type { Adjustment, BrewMethod, InputMode, Strength } from "./schema";
import { strengths } from "./schema";

export const RETENTION_PER_GRAM = 2;
export const MIN_COFFEE_PER_ROUND = 5;
export const MAX_TOTAL_WATER = 4000;
export const MAX_SERVINGS = 12;
export const MAX_ESPRESSO_DRINKS = 6;

export const roundCoffee = (grams: number) => Math.round(grams * 2) / 2;
export const roundWater = (grams: number) => Math.round(grams);
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Calculator primitives (same rounding as the recipes). */
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
  return round1(waterGrams / coffeeGrams);
}
/** Parses "15,5", "15.5" or " 15 "; anything else is NaN. */
export function parseAmount(value: string) {
  const clean = value.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
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

export type BrewParams = {
  methodId: string;
  mode: InputMode;
  /** Servings (cups/drinks), grams of coffee, grams of water or moka size. */
  amount: number;
  strength?: Strength;
  /** Explicit ratio (e.g. from a diagnosis adjustment); clamped to range. */
  ratio?: number;
  /** Espresso basket dose in grams. */
  dose?: number;
};

export type RecipeStep = {
  title: string;
  text: string;
  observe?: string;
  at?: number;
  targetGrams?: number;
};
export type TimedStep = RecipeStep & { at: number };

export type Recipe = {
  ok: true;
  params: Required<
    Pick<BrewParams, "methodId" | "mode" | "amount" | "strength">
  > &
    Pick<BrewParams, "ratio" | "dose">;
  kind: BrewMethod["kind"];
  ratio: number;
  ratioMeaning: "water" | "beverage";
  /** Complete rounds (AeroPress over capacity) or extractions (espresso). */
  rounds: number;
  roundLabel: "rodada" | "extração";
  perRound: {
    coffeeGrams: number;
    waterGrams: number;
    bloomGrams: number | null;
  };
  total: { coffeeGrams: number; waterGrams: number };
  effectiveRatio: number;
  /** Coffee before rounding (total). */
  coffeeExact: number;
  approximate: boolean;
  /** Estimated drink in the cup(s), total, in ml. null when unknown (moka). */
  beverageMl: number | null;
  concentrateMl: number | null;
  servings: number;
  steps: RecipeStep[];
  schedule: TimedStep[];
  /** Duration of one round's timer; null when the method has no timer. */
  totalSeconds: number | null;
  warnings: string[];
  notes: string[];
};
export type RecipeError = { ok: false; error: string };
export type RecipeResult = Recipe | RecipeError;

const fail = (error: string): RecipeError => ({ ok: false, error });

function fill(template: string, values: Record<string, number | null>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? match : formatNumber(value);
  });
}

export function targetRatio(method: BrewMethod, params: BrewParams) {
  if (!method.ratio || !method.ratioRange) return { ratio: 0, clamped: false };
  const base = params.ratio ?? method.ratio[params.strength ?? "equilibrado"];
  const [min, max] = method.ratioRange;
  const ratio = Math.min(max, Math.max(min, base));
  return { ratio: round1(ratio), clamped: ratio !== base };
}

export function generateRecipe(
  method: BrewMethod,
  input: BrewParams,
): RecipeResult {
  const strength: Strength =
    input.strength && strengths.includes(input.strength)
      ? input.strength
      : "equilibrado";
  const amount = Number.isFinite(input.amount) ? input.amount : Number.NaN;
  if (!method.modes.includes(input.mode))
    return fail(`O método ${method.name} não usa esse tipo de quantidade.`);
  if (!(amount > 0)) return fail("Informe uma quantidade maior que zero.");
  const params = {
    methodId: method.id,
    mode: input.mode,
    amount,
    strength,
    ...(input.ratio !== undefined ? { ratio: input.ratio } : {}),
    ...(input.dose !== undefined ? { dose: input.dose } : {}),
  };
  const warnings: string[] = [];
  const notes: string[] = [];

  // --- Moka: the pot defines the amounts --------------------------------
  if (method.kind === "moka" && method.moka) {
    const size = Math.round(amount);
    if (!method.moka.sizes.includes(size))
      return fail(
        `Escolha o tamanho da sua moka: ${method.moka.sizes.join(", ")} xícaras.`,
      );
    const coffeeExact = size * method.moka.coffeePerCupGrams;
    const coffee = roundCoffee(coffeeExact);
    const water = roundWater(size * method.moka.waterPerCupMl);
    notes.push(method.moka.note);
    return finish({
      method,
      params: { ...params, amount: size },
      ratio: ratioFor(coffee, water),
      ratioMeaning: "water",
      rounds: 1,
      perCoffee: coffee,
      perWater: water,
      coffeeExact,
      beverageMl: null,
      concentrateMl: null,
      servings: size,
      warnings,
      notes,
    });
  }

  const { ratio, clamped } = targetRatio(method, params);
  if (clamped)
    warnings.push(
      `A proporção foi ajustada para ${formatRatio(ratio)}, o limite recomendado para ${method.name}.`,
    );

  // --- Espresso: one basket dose per extraction ---------------------------
  if (method.kind === "espresso" && method.espresso) {
    const drinks = Math.round(amount);
    if (drinks < 1 || drinks > MAX_ESPRESSO_DRINKS)
      return fail(`Escolha de 1 a ${MAX_ESPRESSO_DRINKS} espressos.`);
    const dose = roundCoffee(input.dose ?? method.espresso.defaultDose);
    if (dose < method.espresso.minDose || dose > method.espresso.maxDose)
      return fail(
        `A dose por cesto deve ficar entre ${formatNumber(method.espresso.minDose)} e ${formatNumber(method.espresso.maxDose)} g. Confira a indicação do fabricante do seu cesto.`,
      );
    const yieldGrams = roundWater(dose * ratio);
    notes.push(method.espresso.note, method.espresso.pressurized);
    if (drinks > 1)
      notes.push(
        `São ${drinks} extrações separadas, uma de cada vez: ${formatNumber(dose)} g no cesto em cada uma. Nunca coloque a dose de duas bebidas no mesmo cesto.`,
      );
    return finish({
      method,
      params: { ...params, amount: drinks, dose },
      ratio,
      ratioMeaning: "beverage",
      rounds: drinks,
      perCoffee: dose,
      perWater: yieldGrams,
      coffeeExact: dose * drinks,
      beverageMl: yieldGrams * drinks,
      concentrateMl: null,
      servings: drinks,
      warnings,
      notes,
    });
  }

  // --- Filter, immersion and cold brew -------------------------------------
  const dilution = method.kind === "cold" ? (method.cold?.dilution ?? 1) : 0;
  let coffeeExact: number;
  let water: number | null = null;
  if (input.mode === "cups") {
    if (amount > MAX_SERVINGS)
      return fail(`Escolha até ${MAX_SERVINGS} porções por preparo.`);
    // Beverage target → concentrate (cold brew) → coffee, accounting for
    // the water the grounds retain.
    const beverage = amount * method.cup.ml;
    const brewed = beverage / (1 + dilution);
    coffeeExact = brewed / (ratio - RETENTION_PER_GRAM);
  } else if (input.mode === "coffee") {
    coffeeExact = amount;
  } else {
    water = roundWater(amount);
    coffeeExact = water / ratio;
  }
  const totalWaterWanted = water ?? coffeeExact * ratio;
  if (totalWaterWanted > MAX_TOTAL_WATER)
    return fail(
      `Essa quantidade passa de ${formatNumber(MAX_TOTAL_WATER)} g de água. Prepare em lotes menores.`,
    );
  const capacity = method.capacity?.maxWaterPerRound ?? Infinity;
  // The typed amount is kept: in coffee mode the dose, in water mode the water.
  // Rounds are re-checked after rounding, so a rounded dose can never push a
  // round over the equipment's capacity.
  const split = (rounds: number) => {
    const perCoffee =
      input.mode === "coffee" && rounds === 1
        ? roundCoffee(amount)
        : roundCoffee(coffeeExact / rounds);
    const perWater =
      water !== null
        ? roundWater(water / rounds)
        : roundWater(perCoffee * ratio);
    return { perCoffee, perWater };
  };
  let rounds = Math.max(1, Math.ceil(totalWaterWanted / capacity - 1e-9));
  let { perCoffee, perWater } = split(rounds);
  while (perWater > capacity) ({ perCoffee, perWater } = split(++rounds));
  if (perCoffee < MIN_COFFEE_PER_ROUND)
    return fail(
      `Com menos de ${MIN_COFFEE_PER_ROUND} g de café a extração fica difícil de controlar. Aumente a quantidade.`,
    );
  if (rounds > 1 && method.capacity)
    warnings.push(
      `${method.capacity.note} Esta receita usa ${rounds} rodadas de ${formatNumber(perWater)} g de água.`,
    );
  const totalWater = perWater * rounds;
  const totalCoffee = perCoffee * rounds;
  const brewed = Math.max(0, totalWater - RETENTION_PER_GRAM * totalCoffee);
  if (method.cold) notes.push(method.cold.note);
  return finish({
    method,
    params,
    ratio,
    ratioMeaning: "water",
    rounds,
    perCoffee,
    perWater,
    coffeeExact,
    beverageMl: roundWater(brewed * (1 + dilution)),
    concentrateMl: method.kind === "cold" ? roundWater(brewed) : null,
    servings: round1((brewed * (1 + dilution)) / method.cup.ml),
    warnings,
    notes,
  });
}

function finish({
  method,
  params,
  ratio,
  ratioMeaning,
  rounds,
  perCoffee,
  perWater,
  coffeeExact,
  beverageMl,
  concentrateMl,
  servings,
  warnings,
  notes,
}: {
  method: BrewMethod;
  params: Recipe["params"];
  ratio: number;
  ratioMeaning: Recipe["ratioMeaning"];
  rounds: number;
  perCoffee: number;
  perWater: number;
  coffeeExact: number;
  beverageMl: number | null;
  concentrateMl: number | null;
  servings: number;
  warnings: string[];
  notes: string[];
}): Recipe {
  const bloomGrams =
    method.bloomFactor && perCoffee > 0
      ? Math.min(roundWater(perCoffee * method.bloomFactor), perWater)
      : null;
  const roundLabel = method.kind === "espresso" ? "extração" : "rodada";
  const values: Record<string, number | null> = {
    coffee: perCoffee,
    water: perWater,
    yield: perWater,
    bloom: bloomGrams,
    rounds,
    concentrate:
      concentrateMl !== null ? roundWater(concentrateMl / rounds) : null,
    drink: beverageMl !== null ? roundWater(beverageMl / rounds) : null,
  };
  const steps: RecipeStep[] = method.steps.map((step) => {
    const targetGrams =
      step.pour?.type === "bloom"
        ? (bloomGrams ?? undefined)
        : step.pour?.type === "fraction"
          ? roundWater(perWater * step.pour.value)
          : undefined;
    return {
      title: step.title,
      text: fill(step.text, { ...values, target: targetGrams ?? null }),
      ...(step.observe ? { observe: fill(step.observe, values) } : {}),
      ...(step.at !== undefined ? { at: step.at } : {}),
      ...(targetGrams !== undefined ? { targetGrams } : {}),
    };
  });
  if (rounds > 1)
    steps.unshift({
      title: `${rounds} ${roundLabel === "extração" ? "extrações" : "rodadas"}`,
      text:
        roundLabel === "extração"
          ? `Faça ${rounds} extrações, uma de cada vez. Os passos abaixo valem para cada extração.`
          : `Prepare em ${rounds} rodadas completas, uma depois da outra, e junte as bebidas no final. Os passos abaixo valem para cada rodada.`,
    });
  const schedule = method.timer
    ? steps.filter((step): step is TimedStep => step.at !== undefined)
    : [];
  const lastAt = schedule.length ? schedule[schedule.length - 1].at : 0;
  const totalCoffee = perCoffee * rounds;
  const totalWater = perWater * rounds;
  return {
    ok: true,
    params,
    kind: method.kind,
    ratio,
    ratioMeaning,
    rounds,
    roundLabel,
    perRound: { coffeeGrams: perCoffee, waterGrams: perWater, bloomGrams },
    total: { coffeeGrams: totalCoffee, waterGrams: totalWater },
    effectiveRatio: ratioFor(totalCoffee, totalWater),
    coffeeExact: round1(coffeeExact),
    approximate: Math.abs(totalCoffee - coffeeExact) >= 0.05,
    beverageMl,
    concentrateMl,
    servings,
    steps,
    schedule,
    totalSeconds: method.timer
      ? Math.max(method.time.seconds[1], lastAt)
      : null,
    warnings,
    notes,
  };
}

/** One-line summary used by the Barista, the journal and favourites. */
export function summarizeRecipe(method: BrewMethod, recipe: Recipe) {
  const per = recipe.perRound;
  const what =
    recipe.ratioMeaning === "beverage"
      ? `${formatNumber(per.coffeeGrams)} g de café para ${formatNumber(per.waterGrams)} g de bebida`
      : `${formatNumber(per.coffeeGrams)} g de café para ${formatNumber(per.waterGrams)} g de água`;
  const rounds =
    recipe.rounds > 1
      ? ` em cada ${recipe.roundLabel} (${recipe.rounds} ${recipe.roundLabel === "extração" ? "extrações" : "rodadas"})`
      : "";
  return `${method.name}: ${what}${rounds}, proporção ${formatRatio(recipe.effectiveRatio || recipe.ratio)}`;
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

const grindCopy = {
  "mais-grossa": "Deixe a moagem um pouco mais grossa.",
  "mais-fina": "Deixe a moagem um pouco mais fina.",
} as const;

/**
 * Applies a structured diagnosis adjustment to the next attempt. Only the
 * ratio changes the numbers; grind, time and temperature become explicit
 * notes, because the engine cannot measure them.
 */
export function applyAdjustment(
  method: BrewMethod,
  params: BrewParams,
  adjustment: Adjustment,
) {
  const next: BrewParams = { ...params };
  const notes: string[] = [];
  if (adjustment.ratioDelta && method.ratio) {
    const current = targetRatio(method, params).ratio;
    next.ratio = round1(current + adjustment.ratioDelta);
    const bounded = targetRatio(method, next).ratio;
    next.ratio = bounded;
    notes.push(
      bounded === current
        ? `A proporção já está no limite recomendado (${formatRatio(current)}).`
        : `Proporção de ${formatRatio(current)} para ${formatRatio(bounded)}.`,
    );
  }
  if (adjustment.grind) notes.push(grindCopy[adjustment.grind]);
  if (adjustment.timeDelta)
    notes.push(
      adjustment.timeDelta > 0
        ? `Aumente o tempo em cerca de ${adjustment.timeDelta} segundos.`
        : `Reduza o tempo em cerca de ${-adjustment.timeDelta} segundos.`,
    );
  if (adjustment.temperature)
    notes.push(
      adjustment.temperature === "mais-quente"
        ? "Use a água logo depois de ferver."
        : "Espere um pouco mais depois de ferver a água.",
    );
  return { params: next, notes };
}
