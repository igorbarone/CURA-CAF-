import assert from "node:assert/strict";
import { test } from "node:test";
import legacy from "../fixtures/legacy-catalog.json";
import { migrateLegacyCatalog } from "../../scripts/lib/migrate-legacy";
import { publishedCatalog } from "../../lib/catalog-model";
import { recommendCoffees } from "../../lib/quiz";
const entries = publishedCatalog(migrateLegacyCatalog(legacy));
const any = { profile: "", preparation: "", roast: "" };
test("quiz explains every chosen attribute and identifies the matching published lot", () => {
  const results = recommendCoffees(entries, {
    profile: "Doce e cremoso",
    preparation: "Coado",
    roast: "Média",
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].coffee.slug, "samba");
  assert.equal(results[0].lotId, "cura-26-01");
  assert.deepEqual(results[0].reasons, [
    "Perfil confirmado: Doce e cremoso.",
    "Preparo sugerido: Coado.",
    "Torra confirmada: média.",
  ]);
});
test("quiz does not manufacture a recommendation on empty catalogs, no preferences or no full match", () => {
  assert.deepEqual(recommendCoffees([], any), []);
  assert.deepEqual(recommendCoffees(entries, any), []);
  assert.deepEqual(
    recommendCoffees(entries, {
      ...any,
      profile: "Doce e cremoso",
      preparation: "Gelado",
    }),
    [],
  );
});
test("quiz uses only public coffee and lot states and never joins preferences from different lots", () => {
  const input = structuredClone(entries);
  input[0].coffee.status = "draft";
  assert.deepEqual(
    recommendCoffees(input, { ...any, profile: "Doce e cremoso" }),
    [],
  );
  input[0].coffee.status = "published";
  input[0].lots[0].status = "archived";
  assert.deepEqual(
    recommendCoffees(input, { ...any, profile: "Doce e cremoso" }),
    [],
  );
  const fresh = structuredClone(entries);
  fresh[0].lots.push({
    ...fresh[0].lots[0],
    id: "new-test",
    profile: "Outro perfil",
    preparations: ["Gelado"],
  });
  assert.deepEqual(
    recommendCoffees(fresh, {
      ...any,
      profile: "Doce e cremoso",
      preparation: "Gelado",
    }),
    [],
  );
});
test("quiz returns multiple matching coffees with no preference inferred from missing fields", () => {
  const results = recommendCoffees(entries, { ...any, preparation: "Coado" });
  assert.equal(results.length, 2);
  assert.ok(results.every((result) => result.reasons.length === 1));
  const input = structuredClone(entries);
  input[0].lots[0].roast = null;
  assert.equal(recommendCoffees(input, { ...any, roast: "Média" }).length, 0);
});
