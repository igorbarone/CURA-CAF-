import legacy from "../fixtures/legacy-catalog.json";
import { migrateLegacyCatalog } from "../../scripts/lib/migrate-legacy";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContent } from "../../lib/content-loader";
import {
  contentSchema,
  type CoffeeEntity,
  type Lot,
  type Offer,
  type Content,
} from "../../lib/content-schema";
import {
  publishedCatalog,
  publicProduct,
  projectCoffee,
  featuredCatalog,
  catalogFilters,
  filterCatalog,
  coffeePath,
  sortCatalog,
  mediaForLot,
  publicProductRoutes,
  EMPTY_CATALOG_ROUTE,
} from "../../lib/catalog-model";
const current = migrateLegacyCatalog(legacy);
const coffee = (
  id: string,
  overrides: Partial<CoffeeEntity> = {},
): CoffeeEntity => ({
  ...current.coffees[0],
  id,
  slug: id,
  name: `TESTE ${id}`,
  primaryLotId: null,
  ...overrides,
});
const lot = (
  id: string,
  coffeeId: string,
  overrides: Partial<Lot> = {},
): Lot => ({
  ...current.lots[0],
  id,
  coffeeId,
  code: `TESTE-${id}`,
  ...overrides,
});
const offer = (
  id: string,
  lotId: string,
  overrides: Partial<Offer> = {},
): Offer => ({
  id,
  lotId,
  status: "published",
  sku: `TESTE-${id}`,
  currency: "BRL",
  unitPriceInCents: null,
  availableQuantity: null,
  weightInGrams: null,
  grind: null,
  ...overrides,
});
const content = (
  coffees: CoffeeEntity[] = [],
  lots: Lot[] = [],
  offers: Offer[] = [],
): Content => ({
  coffees,
  lots,
  offers,
  home: { ...current.home, featuredCoffeeIds: [] },
});
const filters = { query: "", profile: "", roast: "", preparation: "" };
test("migration preserves names, routes, lot identifiers and all confirmed data", () => {
  for (const row of legacy) {
    const view = projectCoffee(publicProduct(current, row.slug)!);
    for (const [key, value] of Object.entries(row))
      assert.deepEqual(
        view[key as keyof typeof view],
        value,
        `${row.slug}.${key}`,
      );
  }
  assert.equal(current.coffees.length, 2);
  assert.equal(current.lots.length, 2);
  assert.deepEqual(current.offers, []);
  const samba = projectCoffee(publicProduct(current, "samba")!);
  const salsa = projectCoffee(publicProduct(current, "salsa")!);
  assert.deepEqual(
    [
      samba.slug,
      samba.lot,
      samba.score,
      samba.roast,
      samba.notes,
      samba.producers,
      samba.preparation,
      samba.origin,
      samba.body,
      samba.acidity,
      samba.variety,
    ],
    [
      "samba",
      "CURA-26-01",
      84,
      "Média",
      "Rapadura e melaço",
      "Mauricio Lemos e Diego Campos",
      "Coado · Espresso",
      "Origem exata a confirmar.",
      "Cremoso",
      "Média",
      null,
    ],
  );
  assert.deepEqual(
    [
      salsa.slug,
      salsa.lot,
      salsa.score,
      salsa.roast,
      salsa.notes,
      salsa.producers,
      salsa.preparation,
      salsa.origin,
      salsa.body,
      salsa.acidity,
      salsa.variety,
    ],
    [
      "salsa",
      "CURA-26-02",
      86,
      "Clara",
      "Laranja e tangerina",
      "Décio José Lemos",
      "Coado · Gelado",
      "Fazenda Serrinha. Município e UF a confirmar.",
      null,
      "Cítrica",
      "Arara",
    ],
  );
});
test("zero coffees and zero highlights are valid, with no manufactured fallback", () => {
  const data = contentSchema.parse(content());
  assert.deepEqual(publishedCatalog(data), []);
  assert.deepEqual(featuredCatalog(data), []);
  assert.equal(publicProduct(data, "samba"), undefined);
  assert.deepEqual(publicProductRoutes(data), [{ slug: EMPTY_CATALOG_ROUTE }]);
  assert.equal(publicProduct(data, EMPTY_CATALOG_ROUTE), undefined);
});
test("one coffee with no lots is publishable and has honest missing fields", () => {
  const data = contentSchema.parse(content([coffee("test")]));
  const entry = publishedCatalog(data)[0];
  assert.equal(entry.lots.length, 0);
  const view = projectCoffee(entry);
  assert.equal(view.score, null);
  assert.equal(view.lotId, null);
  assert.equal(view.lot, "Lote a confirmar");
  assert.equal(filterCatalog([entry], filters).length, 1);
  assert.equal(
    filterCatalog([entry], { ...filters, roast: "Média" }).length,
    0,
  );
});
test("arbitrary counts, order and primary lots do not depend on coffee names", () => {
  const data = content(
    Array.from({ length: 7 }, (_, i) =>
      coffee(`test-${i}`, { sortOrder: 6 - i }),
    ),
    [
      lot("first", "test-0", { sortOrder: 1 }),
      lot("primary", "test-0", { sortOrder: 9 }),
    ],
  );
  data.coffees[0].primaryLotId = "primary";
  assert.equal(publishedCatalog(data).length, 7);
  assert.equal(publishedCatalog(data)[0].coffee.id, "test-6");
  const entry = publicProduct(data, "test-0")!;
  assert.equal(projectCoffee(entry).lotId, "primary");
  assert.equal(projectCoffee(entry, "first").lotId, "first");
  assert.equal(projectCoffee(entry, "missing").lotId, "primary");
});
test("filters are derived and deduplicated across all published lots", () => {
  const data = content(
    [coffee("test")],
    [
      lot("first", "test", {
        profile: "Novo perfil",
        roast: "Nova torra",
        preparations: ["Novo preparo", "Coado"],
      }),
      lot("second", "test", {
        profile: "Novo perfil",
        preparations: ["Coado"],
      }),
      lot("secret", "test", { status: "draft", profile: "Perfil privado" }),
    ],
  );
  const entries = publishedCatalog(data);
  const result = catalogFilters(entries);
  assert.deepEqual(result.profiles, ["Novo perfil"]);
  assert.equal(result.preparations.filter((x) => x === "Coado").length, 1);
  assert.ok(result.roasts.includes("Nova torra"));
  assert.ok(result.preparations.includes("Novo preparo"));
});
test("search and AND filters must match the same lot, not different lots of a coffee", () => {
  const entries = publishedCatalog(
    content(
      [coffee("test")],
      [
        lot("one", "test", {
          profile: "Perfil A",
          roast: "Clara",
          notes: ["Teste maçã"],
        }),
        lot("two", "test", {
          profile: "Perfil B",
          roast: "Média",
          notes: ["Teste canela"],
        }),
      ],
    ),
  );
  assert.equal(
    filterCatalog(entries, {
      ...filters,
      query: "TESTE CANELA",
      profile: "Perfil B",
    }).length,
    1,
  );
  assert.equal(
    filterCatalog(entries, { ...filters, profile: "Perfil A", roast: "Média" })
      .length,
    0,
  );
  assert.equal(
    filterCatalog(entries, { ...filters, query: "canela", profile: "Perfil A" })
      .length,
    0,
  );
});
test("drafts and archived lots and offers never leak into public projections", () => {
  const data = content(
    [
      coffee("public"),
      coffee("secret", { status: "draft" }),
      coffee("old", { status: "archived" }),
    ],
    [
      lot("visible", "public"),
      lot("hidden", "public", { status: "draft" }),
      lot("old", "public", { status: "archived" }),
      lot("parent-hidden", "secret"),
    ],
    [
      offer("visible", "visible"),
      offer("hidden", "hidden"),
      offer("old", "old"),
      offer("parent-hidden", "parent-hidden"),
      offer("draft-offer", "visible", { status: "draft" }),
    ],
  );
  const entries = publishedCatalog(data);
  assert.equal(entries.length, 1);
  assert.deepEqual(
    entries[0].lots.map((x) => x.id),
    ["visible"],
  );
  assert.deepEqual(
    entries[0].offers.map((x) => x.id),
    ["visible"],
  );
  assert.equal(publicProduct(data, "secret"), undefined);
  assert.deepEqual(publicProduct(data, "old")?.lots, []);
  assert.deepEqual(publicProduct(data, "old")?.offers, []);
});
test("Home uses explicit order, supports no highlights and hides archived references", () => {
  const data = content([
    coffee("one"),
    coffee("two"),
    coffee("hidden", { status: "draft" }),
    coffee("old", { status: "archived" }),
  ]);
  data.home.featuredCoffeeIds = ["two", "old", "hidden", "one"];
  assert.deepEqual(
    featuredCatalog(contentSchema.parse(data)).map((x) => x.coffee.id),
    ["two", "one"],
  );
  data.home.featuredCoffeeIds = [];
  assert.deepEqual(featuredCatalog(data), []);
});
test("multiple offers belong to a lot without enabling checkout or creating prices", () => {
  const data = contentSchema.parse(
    content(
      [coffee("test")],
      [lot("one", "test"), lot("two", "test")],
      [offer("a", "one"), offer("b", "one"), offer("c", "two")],
    ),
  );
  const entry = publishedCatalog(data)[0];
  assert.equal(entry.offers.length, 3);
  assert.equal(entry.offers.filter((x) => x.lotId === "one").length, 2);
  assert.ok(
    entry.offers.every(
      (x) => x.unitPriceInCents === null && x.availableQuantity === null,
    ),
  );
});
test("schema rejects duplicate ids/slugs/codes/SKUs, broken relations and mismatched primary lot", () => {
  const invalid = [
    content([coffee("one"), coffee("one")]),
    content([coffee("one"), coffee("two", { slug: "one" })]),
    content([coffee("one")], [lot("missing", "ghost")]),
    content([coffee("one")], [], [offer("bad", "ghost")]),
    content(
      [coffee("one", { primaryLotId: "other" }), coffee("two")],
      [lot("other", "two")],
    ),
    content(
      [coffee("one")],
      [lot("a", "one"), lot("b", "one", { code: "TESTE-a" })],
    ),
    content(
      [coffee("one")],
      [lot("a", "one")],
      [offer("a", "a"), offer("b", "a", { sku: "TESTE-a" })],
    ),
  ];
  for (const data of invalid)
    assert.equal(contentSchema.safeParse(data).success, false);
  const data = content([coffee("one")]);
  data.home.featuredCoffeeIds = ["missing"];
  assert.equal(contentSchema.safeParse(data).success, false);
  data.home.featuredCoffeeIds = ["one", "one"];
  assert.equal(contentSchema.safeParse(data).success, false);
});
test("invalid prices, stock, scores and unsafe media paths are rejected", () => {
  const data = content([coffee("one")], [lot("a", "one")], [offer("a", "a")]);
  for (const n of [-1, 1.5, Infinity]) {
    data.offers[0].unitPriceInCents = n;
    assert.equal(contentSchema.safeParse(data).success, false);
  }
  data.offers[0].unitPriceInCents = null;
  data.offers[0].availableQuantity = -1;
  assert.equal(contentSchema.safeParse(data).success, false);
  data.offers = [];
  data.lots[0].score = 101;
  assert.equal(contentSchema.safeParse(data).success, false);
  for (const src of [
    "/media/../secret.png",
    "https://remote.invalid/image.jpg",
    "/media/script.svg",
  ]) {
    data.coffees[0].media = {
      kind: "photograph",
      lotId: null,
      src,
      alt: "Teste",
      credit: "Teste",
    };
    assert.equal(contentSchema.safeParse(data).success, false);
  }
  // Descriptions are plain strings, never rendered with dangerouslySetInnerHTML.
});
test("CMS empty optional fields normalize to null, never to a zero price or stock", () => {
  const data = content([coffee("one")], [lot("a", "one")], [offer("a", "a")]);
  const input = JSON.parse(JSON.stringify(data));
  input.coffees[0].media = {
    kind: "photograph",
    lotId: null,
    src: "",
    alt: "",
    credit: "",
  };
  input.coffees[0].primaryLotId = "";
  input.lots[0].score = "";
  input.lots[0].body = "";
  input.offers[0].unitPriceInCents = "";
  delete input.offers[0].availableQuantity;
  const parsed = contentSchema.parse(input);
  assert.equal(parsed.coffees[0].media, null);
  assert.equal(parsed.coffees[0].primaryLotId, null);
  assert.equal(parsed.lots[0].score, null);
  assert.equal(parsed.lots[0].body, null);
  assert.equal(parsed.offers[0].unitPriceInCents, null);
  assert.equal(parsed.offers[0].availableQuantity, null);
});
test("loader accepts media under public/media and rejects missing files and mismatched filenames", () => {
  const root = mkdtempSync(join(tmpdir(), "cura-content-test-"));
  try {
    for (const dir of [
      "content/coffees",
      "content/lots",
      "content/offers",
      "public/media",
    ])
      mkdirSync(join(root, dir), { recursive: true });
    const item = coffee("test", {
      media: {
        kind: "photograph",
        lotId: null,
        src: "/media/test.png",
        alt: "Imagem técnica de teste",
        credit: "Fixture de teste",
      },
    });
    writeFileSync(
      join(root, "content/coffees/test.json"),
      JSON.stringify(item),
    );
    writeFileSync(
      join(root, "content/home.json"),
      JSON.stringify({ ...current.home, featuredCoffeeIds: ["test"] }),
    );
    assert.throws(() => loadContent(root));
    writeFileSync(join(root, "public/media/test.png"), Buffer.from("fixture"));
    assert.equal(loadContent(root).coffees[0].media?.src, "/media/test.png");
    writeFileSync(
      join(root, "content/coffees/test.json"),
      JSON.stringify({ ...item, id: "changed" }),
    );
    assert.throws(() => loadContent(root), /nome do arquivo/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("editorial SVG accepts static vectors and refuses active or remote content", () => {
  const root = mkdtempSync(join(tmpdir(), "cura-svg-test-"));
  try {
    for (const dir of [
      "content/coffees",
      "content/lots",
      "content/offers",
      "public/media",
    ])
      mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(
      join(root, "content/coffees/test.json"),
      JSON.stringify(
        coffee("test", {
          media: {
            kind: "artwork",
            lotId: null,
            src: "/media/rotulo-test.svg",
            alt: "Arte técnica de teste",
            credit: "Fixture",
          },
        }),
      ),
    );
    writeFileSync(
      join(root, "content/home.json"),
      JSON.stringify({ ...current.home, featuredCoffeeIds: ["test"] }),
    );
    const path = join(root, "public/media/rotulo-test.svg");
    writeFileSync(
      path,
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>',
    );
    assert.equal(loadContent(root).coffees[0].media?.kind, "artwork");
    for (const invalid of [
      "<svg><script>alert(1)</script></svg>",
      '<svg onload="alert(1)"/>',
      '<svg><use href="https://invalid.test/resource"/></svg>',
      '<svg><style>@import "https://invalid.test/x";</style></svg>',
    ]) {
      writeFileSync(path, invalid);
      assert.throws(() => loadContent(root), /SVG editorial/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("filtered cards project one matching lot, including score, origin, producer and offers", () => {
  const entry = publicEntryForFilterTest();
  const snapshot = JSON.stringify(entry);
  const filtered = filterCatalog([entry], { ...filters, roast: "Clara" });
  const view = projectCoffee(filtered[0]);
  assert.deepEqual(
    [
      view.lotId,
      view.score,
      view.roast,
      view.notes,
      view.producers,
      view.origin,
      view.preparation,
      view.producerStory,
    ],
    [
      "alternate",
      86,
      "Clara",
      "Nota B",
      "Produtor B",
      "Origem B",
      "Gelado",
      "História técnica do lote B.",
    ],
  );
  assert.deepEqual(
    filtered[0].offers.map((item) => item.id),
    ["offer-b"],
  );
  assert.equal(coffeePath(view), "/cafes/variable/?lote=alternate");
  for (const partial of [
    { profile: "Perfil B" },
    { query: "Produtor B" },
    { preparation: "Gelado" },
  ])
    assert.equal(
      projectCoffee(filterCatalog([entry], { ...filters, ...partial })[0])
        .lotId,
      "alternate",
    );
  assert.equal(
    filterCatalog([entry], { ...filters, roast: "Clara", profile: "Perfil A" })
      .length,
    0,
  );
  assert.equal(projectCoffee(filterCatalog([entry], filters)[0]).score, 84);
  assert.equal(JSON.stringify(entry), snapshot);
});

function publicEntryForFilterTest() {
  return publishedCatalog(
    content(
      [coffee("variable", { primaryLotId: "primary" })],
      [
        lot("primary", "variable", {
          score: 84,
          roast: "Média",
          profile: "Perfil A",
        }),
        lot("alternate", "variable", {
          score: 86,
          roast: "Clara",
          profile: "Perfil B",
          notes: ["Nota B"],
          producers: ["Produtor B"],
          origin: "Origem B",
          preparations: ["Gelado"],
          producerStory: "História técnica do lote B.",
        }),
      ],
      [offer("offer-a", "primary"), offer("offer-b", "alternate")],
    ),
  )[0];
}

test("score ordering follows the displayed lot, while unknown scores stay unknown", () => {
  const variable = publicEntryForFilterTest();
  const other = publishedCatalog(
    content([coffee("other")], [lot("single", "other", { score: 85 })]),
  )[0];
  const unknown = publishedCatalog(
    content(
      [coffee("unknown")],
      [lot("unknown-lot", "unknown", { score: null })],
    ),
  )[0];
  const sorted = sortCatalog([variable, unknown, other], "score-desc");
  assert.deepEqual(
    sorted.map((entry) => projectCoffee(entry).score),
    [85, 84, null],
  );
  assert.equal(projectCoffee(unknown).score, null);
});

test("label media remains tied to its recorded lot when filters or the primary lot change", () => {
  const entry = publicEntryForFilterTest();
  const media = {
    kind: "artwork" as const,
    lotId: "primary",
    src: "/media/rotulo-test.svg",
    alt: "Arte técnica",
    credit: "Teste",
  };
  entry.coffee.media = media;
  assert.equal(mediaForLot(projectCoffee(entry))?.src, media.src);
  assert.equal(
    mediaForLot(
      projectCoffee(filterCatalog([entry], { ...filters, roast: "Clara" })[0]),
    ),
    null,
  );
  entry.coffee.primaryLotId = "alternate";
  assert.equal(mediaForLot(projectCoffee(entry)), null);
  entry.coffee.media = { ...media, lotId: null };
  assert.equal(mediaForLot(projectCoffee(entry)), null);
  entry.coffee.media = {
    ...media,
    kind: "photograph",
    lotId: null,
    src: "/media/test.png",
  };
  assert.equal(mediaForLot(projectCoffee(entry))?.src, "/media/test.png");
  const bad = content([coffee("one", { media })], [lot("primary", "another")]);
  assert.equal(contentSchema.safeParse(bad).success, false);
});
