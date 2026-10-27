import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_COMPARE,
  comparePath,
  parseCompareSlugs,
  roastLevel,
} from "../../lib/compare";
test("roast meter follows the label scale and ignores unknown roasts", () => {
  assert.equal(roastLevel("Clara"), 1);
  assert.equal(roastLevel("Média"), 2);
  assert.equal(roastLevel("média-escura"), 3);
  assert.equal(roastLevel("Escura"), 4);
  assert.equal(roastLevel("A confirmar"), null);
  assert.equal(roastLevel(null), null);
});
test("shared comparison links keep only valid, unique coffees up to the limit", () => {
  const valid = ["samba", "salsa", "a", "b"];
  assert.deepEqual(
    parseCompareSlugs("salsa, samba,salsa,inventado,a,b", valid),
    ["salsa", "samba", "a"].slice(0, MAX_COMPARE),
  );
  assert.deepEqual(parseCompareSlugs(null, valid), []);
  assert.equal(comparePath([]), "/comparar/");
  assert.equal(comparePath(["samba", "salsa"]), "/comparar/?cafes=samba,salsa");
});
