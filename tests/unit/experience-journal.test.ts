import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "../../lib/content-loader";
import { publishedCatalog } from "../../lib/catalog-model";
import { toExperienceCoffee } from "../../lib/experience/coffee";
import { loadExperience } from "../../lib/experience/content";
import { generateRecipe, summarizeRecipe } from "../../lib/experience/brew";
import {
  JOURNAL_KEY,
  MAX_ENTRIES,
  addEntry,
  addFavorite,
  emptyJournal,
  journalStats,
  loadJournal,
  rateEntry,
  removeFavorite,
  saveJournal,
  suggestNextCoffee,
  type JournalStorage,
} from "../../lib/experience/journal";

const { methods, taste } = loadExperience();
const coffees = publishedCatalog(loadContent()).map(toExperienceCoffee);
const memory = (): JournalStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};
const v60 = methods.find((m) => m.id === "v60")!;
const params = { methodId: "v60", mode: "water" as const, amount: 250 };
const recipe = generateRecipe(v60, params);
assert.ok(recipe.ok);
const summary = summarizeRecipe(v60, recipe);

test("journal persists validated entries and survives corrupted or blocked storage", () => {
  const storage = memory();
  const created = addEntry(emptyJournal(), {
    coffeeSlug: "salsa",
    params,
    summary,
  });
  const entry = created.entry;
  let journal = created.journal;
  assert.ok(saveJournal(storage, journal));
  assert.deepEqual(loadJournal(storage), journal);
  storage.data.set(JOURNAL_KEY, "{broken");
  assert.deepEqual(loadJournal(storage), emptyJournal());
  storage.data.set(
    JOURNAL_KEY,
    JSON.stringify({ version: 1, entries: [{ id: "x" }], favorites: [] }),
  );
  assert.deepEqual(loadJournal(storage), emptyJournal());
  assert.deepEqual(loadJournal(null), emptyJournal());
  assert.equal(saveJournal(null, journal), false);
  const throwing: JournalStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(loadJournal(throwing), emptyJournal());
  assert.equal(saveJournal(throwing, journal), false);
  journal = rateEntry(journal, entry.id, {
    outcome: "amargo",
    adjustment: { text: "Moagem mais grossa", notes: [] },
  });
  assert.equal(journal.entries[0].outcome, "amargo");
});

test("an adjusted attempt links to the original and the history stays coherent", () => {
  const created = addEntry(emptyJournal(), {
    coffeeSlug: "salsa",
    params,
    summary,
  });
  const first = created.entry;
  let journal = created.journal;
  journal = rateEntry(journal, first.id, { outcome: "fraco" });
  const next = { ...params, ratio: 15 };
  const nextRecipe = generateRecipe(v60, next);
  assert.ok(nextRecipe.ok);
  const second = addEntry(journal, {
    coffeeSlug: "salsa",
    params: next,
    summary: summarizeRecipe(v60, nextRecipe),
    previousId: first.id,
  });
  journal = second.journal;
  assert.equal(journal.entries[0].previousId, first.id);
  // The stored parameters regenerate exactly the recipe that was shown.
  const replay = generateRecipe(v60, journal.entries[0].params);
  assert.ok(replay.ok);
  assert.equal(summarizeRecipe(v60, replay), journal.entries[0].summary);
});

test("favourites are deduplicated, capped and removable; entries are capped", () => {
  let journal = emptyJournal();
  journal = addFavorite(journal, {
    name: "Meu V60",
    coffeeSlug: "salsa",
    params,
    summary,
  });
  journal = addFavorite(journal, {
    name: "Meu V60 de novo",
    coffeeSlug: "salsa",
    params,
    summary,
  });
  assert.equal(journal.favorites.length, 1);
  assert.equal(journal.favorites[0].name, "Meu V60 de novo");
  journal = removeFavorite(journal, journal.favorites[0].id);
  assert.equal(journal.favorites.length, 0);
  for (let i = 0; i < MAX_ENTRIES + 5; i++)
    journal = addEntry(journal, { params, summary }).journal;
  assert.equal(journal.entries.length, MAX_ENTRIES);
  assert.throws(() => addFavorite(journal, { name: "", params, summary }));
});

test("stats are plain counts; the suggestion explains itself with published attributes", () => {
  let journal = emptyJournal();
  journal = addEntry(journal, { coffeeSlug: "salsa", params, summary }).journal;
  journal = rateEntry(journal, journal.entries[0].id, {
    outcome: "equilibrado",
  });
  journal = addEntry(journal, {
    coffeeSlug: "salsa",
    params: { methodId: "prensa-francesa", mode: "cups", amount: 2 },
    summary: "x",
  }).journal;
  const stats = journalStats(journal, coffees, methods);
  assert.equal(stats.brews, 2);
  assert.equal(stats.balanced, 1);
  assert.deepEqual(stats.coffeesTried, [
    { slug: "salsa", name: "SALSA", total: 2 },
  ]);
  assert.equal(stats.methodsUsed.length, 2);
  const suggestion = suggestNextCoffee(journal, coffees, taste);
  assert.ok(suggestion);
  assert.notEqual(suggestion.coffee.slug, "salsa");
  assert.match(suggestion.reason, /SALSA/);
  assert.match(suggestion.reason, /\(.+: .+\)|ainda não registrou/);
  assert.equal(suggestNextCoffee(emptyJournal(), coffees, taste), null);
});
