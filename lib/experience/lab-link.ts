// Structured hand-off to the Laboratório. The Barista (local or AI),
// favourites, the journal and coffee pages all build the same URL from
// BrewParams, and the Lab reads it back with the same validation, so a
// recipe never has to be rebuilt from free text.
import type { BrewParams } from "./brew";
import { inputModes, strengths, type InputMode, type Strength } from "./schema";

export type LabState = BrewParams & { coffeeSlug?: string };

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const toNumber = (value: string | null) => {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export function labSearch(state: LabState) {
  const params = new URLSearchParams();
  if (state.coffeeSlug) params.set("cafe", state.coffeeSlug);
  params.set("metodo", state.methodId);
  params.set("modo", state.mode);
  params.set("qtd", String(state.amount));
  if (state.strength && state.strength !== "equilibrado")
    params.set("intensidade", state.strength);
  if (state.ratio !== undefined) params.set("proporcao", String(state.ratio));
  if (state.dose !== undefined) params.set("dose", String(state.dose));
  return params.toString();
}
export const labHref = (state: LabState) =>
  `/experiencia/preparar/?${labSearch(state)}`;

/**
 * Reads Lab parameters. Unknown coffees or methods are dropped instead of
 * guessed. `xicaras` is the legacy (Phase 1) name for a number of cups.
 */
export function parseLabSearch(
  search: string,
  known: { coffees: string[]; methods: string[] },
): Partial<LabState> {
  const params = new URLSearchParams(search);
  const state: Partial<LabState> = {};
  const cafe = params.get("cafe");
  if (cafe && slug.test(cafe) && known.coffees.includes(cafe))
    state.coffeeSlug = cafe;
  const metodo = params.get("metodo");
  if (metodo && known.methods.includes(metodo)) state.methodId = metodo;
  const mode = params.get("modo");
  if (mode && (inputModes as readonly string[]).includes(mode))
    state.mode = mode as InputMode;
  const amount = toNumber(params.get("qtd"));
  const legacyCups = toNumber(params.get("xicaras"));
  if (amount !== undefined) state.amount = amount;
  else if (legacyCups !== undefined) {
    state.mode = "cups";
    state.amount = legacyCups;
  }
  const strength = params.get("intensidade");
  if (strength && (strengths as readonly string[]).includes(strength))
    state.strength = strength as Strength;
  const ratio = toNumber(params.get("proporcao"));
  if (ratio !== undefined) state.ratio = ratio;
  const dose = toNumber(params.get("dose"));
  if (dose !== undefined) state.dose = dose;
  return state;
}
