// "Minha jornada": brew journal, favourite recipes and simple, honest stats.
// Stored only in this browser (no account, no server, no sync between
// devices). Everything read back is validated: a corrupted or older value is
// discarded instead of breaking the page. Recipes are stored as BrewParams
// and recomputed by the engine, so a saved recipe never drifts from the Lab.
import { z } from "zod";
import type { ExperienceCoffee } from "./coffee";
import type { BrewMethod, Taste } from "./schema";
import { coffeeTraits } from "./taste";

export const JOURNAL_KEY = "cura-experience-journal-v1";
export const MAX_ENTRIES = 60;
export const MAX_FAVORITES = 20;

const slug = z.string().regex(/^[a-z0-9-]{1,40}$/);
export const brewParamsSchema = z
  .object({
    methodId: slug,
    mode: z.enum(["cups", "coffee", "water", "size"]),
    amount: z.number().positive().max(10000),
    strength: z.enum(["suave", "equilibrado", "intenso"]).optional(),
    ratio: z.number().positive().max(30).optional(),
    dose: z.number().positive().max(40).optional(),
  })
  .strict();
const outcome = z.enum([
  "amargo",
  "azedo",
  "fraco",
  "forte",
  "equilibrado",
  "nao-sei",
]);
const entrySchema = z
  .object({
    id: z.string().min(4).max(40),
    at: z.string().datetime(),
    coffeeSlug: slug.optional(),
    params: brewParamsSchema,
    summary: z.string().max(240),
    outcome: outcome.optional(),
    adjustment: z
      .object({
        text: z.string().max(400),
        notes: z.array(z.string().max(200)).max(4),
      })
      .strict()
      .optional(),
    note: z.string().max(280).optional(),
    previousId: z.string().max(40).optional(),
  })
  .strict();
const favoriteSchema = z
  .object({
    id: z.string().min(4).max(40),
    name: z.string().trim().min(1).max(60),
    savedAt: z.string().datetime(),
    coffeeSlug: slug.optional(),
    params: brewParamsSchema,
    summary: z.string().max(240),
  })
  .strict();
const journalSchema = z
  .object({
    version: z.literal(1),
    entries: z.array(entrySchema).max(MAX_ENTRIES),
    favorites: z.array(favoriteSchema).max(MAX_FAVORITES),
  })
  .strict();
export type BrewEntry = z.infer<typeof entrySchema>;
export type Favorite = z.infer<typeof favoriteSchema>;
export type Journal = z.infer<typeof journalSchema>;
export type JournalStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const emptyJournal = (): Journal => ({
  version: 1,
  entries: [],
  favorites: [],
});
const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function loadJournal(storage: JournalStorage | null): Journal {
  if (!storage) return emptyJournal();
  try {
    const raw = storage.getItem(JOURNAL_KEY);
    if (!raw) return emptyJournal();
    const parsed = journalSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyJournal();
  } catch {
    return emptyJournal();
  }
}
/** Returns false when the browser does not keep data (private mode, blocked). */
export function saveJournal(storage: JournalStorage | null, journal: Journal) {
  if (!storage) return false;
  try {
    storage.setItem(JOURNAL_KEY, JSON.stringify(journalSchema.parse(journal)));
    return true;
  } catch {
    return false;
  }
}

export function addEntry(
  journal: Journal,
  entry: Omit<BrewEntry, "id" | "at"> & { at?: string },
): { journal: Journal; entry: BrewEntry } {
  const created = entrySchema.parse({
    ...entry,
    id: newId(),
    at: entry.at ?? new Date().toISOString(),
  });
  return {
    entry: created,
    journal: {
      ...journal,
      entries: [created, ...journal.entries].slice(0, MAX_ENTRIES),
    },
  };
}
export function rateEntry(
  journal: Journal,
  id: string,
  update: Pick<BrewEntry, "outcome" | "adjustment" | "note">,
): Journal {
  return {
    ...journal,
    entries: journal.entries.map((entry) =>
      entry.id === id ? entrySchema.parse({ ...entry, ...update }) : entry,
    ),
  };
}
export function removeEntry(journal: Journal, id: string): Journal {
  return {
    ...journal,
    entries: journal.entries.filter((entry) => entry.id !== id),
  };
}
export function addFavorite(
  journal: Journal,
  favorite: Omit<Favorite, "id" | "savedAt">,
): Journal {
  const created = favoriteSchema.parse({
    ...favorite,
    id: newId(),
    savedAt: new Date().toISOString(),
  });
  const same = (item: Favorite) =>
    JSON.stringify(item.params) === JSON.stringify(created.params) &&
    item.coffeeSlug === created.coffeeSlug;
  return {
    ...journal,
    favorites: [
      created,
      ...journal.favorites.filter((item) => !same(item)),
    ].slice(0, MAX_FAVORITES),
  };
}
export function removeFavorite(journal: Journal, id: string): Journal {
  return {
    ...journal,
    favorites: journal.favorites.filter((item) => item.id !== id),
  };
}

/** Plain counts of what the person recorded — not a sensory "score". */
export function journalStats(
  journal: Journal,
  coffees: ExperienceCoffee[],
  methods: BrewMethod[],
) {
  const count = <T extends string>(values: T[]) =>
    [
      ...values.reduce(
        (map, value) => map.set(value, (map.get(value) ?? 0) + 1),
        new Map<T, number>(),
      ),
    ].sort((a, b) => b[1] - a[1]);
  const methodsUsed = count(
    journal.entries.map((entry) => entry.params.methodId),
  ).map(([id, total]) => ({
    id,
    name: methods.find((method) => method.id === id)?.name ?? id,
    total,
  }));
  const coffeesTried = count(
    journal.entries.flatMap((entry) =>
      entry.coffeeSlug ? [entry.coffeeSlug] : [],
    ),
  ).map(([slug, total]) => ({
    slug,
    name: coffees.find((coffee) => coffee.slug === slug)?.name ?? slug,
    total,
  }));
  const rated = journal.entries.filter((entry) => entry.outcome);
  const recent = rated.slice(0, 10).reverse();
  return {
    brews: journal.entries.length,
    rated: rated.length,
    balanced: rated.filter((entry) => entry.outcome === "equilibrado").length,
    methodsUsed,
    coffeesTried,
    /** Last ten rated brews, oldest first, to show the sequence of results. */
    recentOutcomes: recent.map((entry) => ({
      id: entry.id,
      at: entry.at,
      outcome: entry.outcome as string,
    })),
  };
}

/**
 * Suggests a coffee the person has not recorded yet, explaining why with
 * published attributes: shared traits with a coffee they liked, or the
 * contrast ("outro perfil") when nothing is shared. Never during a brew.
 */
export function suggestNextCoffee(
  journal: Journal,
  coffees: ExperienceCoffee[],
  taste: Taste,
) {
  const tried = new Set(
    journal.entries.flatMap((entry) =>
      entry.coffeeSlug ? [entry.coffeeSlug] : [],
    ),
  );
  for (const favorite of journal.favorites)
    if (favorite.coffeeSlug) tried.add(favorite.coffeeSlug);
  if (!tried.size) return null;
  const liked =
    journal.entries.find(
      (entry) => entry.coffeeSlug && entry.outcome === "equilibrado",
    )?.coffeeSlug ??
    journal.favorites.find((item) => item.coffeeSlug)?.coffeeSlug ??
    [...tried][0];
  const likedCoffee = coffees.find((coffee) => coffee.slug === liked);
  const candidates = coffees.filter((coffee) => !tried.has(coffee.slug));
  if (!likedCoffee || !candidates.length) return null;
  const likedTraits = new Set(
    coffeeTraits(likedCoffee, taste).map((trait) => trait.trait),
  );
  const ranked = candidates
    .map((coffee) => {
      const traits = coffeeTraits(coffee, taste);
      return {
        coffee,
        traits,
        shared: traits.filter((trait) => likedTraits.has(trait.trait)),
      };
    })
    .sort(
      (a, b) =>
        b.shared.length - a.shared.length || b.traits.length - a.traits.length,
    );
  const best = ranked[0];
  const reason = best.shared.length
    ? `Tem em comum com o ${likedCoffee.name}: ${best.shared.map((trait) => `${trait.label} (${trait.evidence})`).join("; ")}.`
    : best.traits.length
      ? `Para conhecer outro perfil depois do ${likedCoffee.name}: ${best.traits.map((trait) => `${trait.label} (${trait.evidence})`).join("; ")}.`
      : `Você ainda não registrou o ${best.coffee.name}. ${best.coffee.description}`;
  return { coffee: best.coffee, reason, basedOn: likedCoffee.name };
}
