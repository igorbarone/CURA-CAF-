import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { coffeeSchema } from "../../lib/content-schema";
import { sortCatalog, publishedCatalog } from "../../lib/catalog-model";
import { migrateLegacyCatalog } from "../../scripts/lib/migrate-legacy";
import legacy from "../fixtures/legacy-catalog.json";
function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(path, entry.name))
      : [join(path, entry.name)],
  );
}
test("runtime and official web vectors contain no old institutional tokens", () => {
  for (const file of [
    ...files("app"),
    ...files("components"),
    ...files("lib"),
    ...files("public/brand"),
    ...files("public/media"),
    "tailwind.config.ts",
  ].filter((file) => /\.(css|ts|tsx|svg)$/.test(file)))
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /#17352a|#0f2a20|--green/gi,
      file,
    );
  const css = readFileSync("app/globals.css", "utf8");
  for (const color of [
    "#3A2618",
    "#EFE9DD",
    "#BF9A50",
    "#1E130C",
    "#8B2A3C",
    "#5E3C73",
    "#2D5B7B",
    "#8E521C",
    "#7E5C43",
  ])
    assert.ok(css.toLowerCase().includes(color.toLowerCase()), color);
  assert.match(readFileSync("app/layout.tsx", "utf8"), /archivo\/standard.css/);
  assert.match(css, /'wdth' 125|"wdth" 125/);
});
test("all official profile families are available without restricting coffee identities", () => {
  assert.deepEqual(coffeeSchema.shape.tone.options, [
    "rapadura",
    "anil",
    "amora",
    "ipe",
    "cacau",
    "cura",
  ]);
  for (const name of [
    "cura-logo.svg",
    "cura-logo-negativo.svg",
    "cura-simbolo.svg",
  ]) {
    const svg = readFileSync(`public/brand/${name}`, "utf8");
    assert.match(svg, /<svg/);
    assert.doesNotMatch(svg, /<text|<image|<script/i);
  }
});
test("ordering is stable and never mutates editorial data or invents commercial values", () => {
  const entries = publishedCatalog(migrateLegacyCatalog(legacy));
  const snapshot = JSON.stringify(entries);
  assert.equal(sortCatalog(entries, "name-asc")[0].coffee.slug, "salsa");
  assert.equal(sortCatalog(entries, "name-desc")[0].coffee.slug, "samba");
  assert.equal(sortCatalog(entries, "score-desc")[0].coffee.slug, "salsa");
  assert.deepEqual(sortCatalog(entries, "curation"), entries);
  assert.equal(JSON.stringify(entries), snapshot);
  assert.deepEqual(sortCatalog([], "score-desc"), []);
});
