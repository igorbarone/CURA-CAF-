/** Builds an isolated, explicitly synthetic dataset; always restores the real export. */
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import legacy from "../tests/fixtures/legacy-catalog.json";
import { migrateLegacyCatalog } from "./lib/migrate-legacy";
const root = mkdtempSync(join(tmpdir(), "cura-editorial-scenarios-"));
const image = join(process.cwd(), "public/media/cms-fixture.png");
if (existsSync(image))
  throw new Error(
    "Preservando arquivo existente: public/media/cms-fixture.png",
  );
const content = migrateLegacyCatalog(legacy);
const source = content.coffees[0],
  sourceLot = content.lots[0];
content.coffees.push(
  {
    ...source,
    id: "fixture-editorial",
    slug: "fixture-editorial",
    name: "CAFÉ TÉCNICO DE TESTE",
    primaryLotId: "fixture-b",
    media: {
      src: "/media/cms-fixture.png",
      alt: "Imagem técnica de teste, não é fotografia de café",
      credit: "Fixture técnica, não é foto de produto",
    },
  },
  {
    ...source,
    id: "fixture-empty",
    slug: "fixture-empty",
    name: "CAFÉ SEM LOTE — TESTE",
    primaryLotId: null,
  },
  {
    ...source,
    id: "fixture-archived",
    slug: "fixture-archived",
    name: "CAFÉ ARQUIVADO — TESTE",
    status: "archived",
    primaryLotId: null,
  },
  {
    ...source,
    id: "fixture-draft",
    slug: "fixture-draft",
    name: "DRAFT-SENTINEL-NEVER-PUBLISH",
    status: "draft",
    primaryLotId: null,
  },
);
content.lots.push(
  {
    ...sourceLot,
    id: "fixture-a",
    code: "TEST-ONLY-A",
    coffeeId: "fixture-editorial",
    profile: "Perfil técnico A",
  },
  {
    ...sourceLot,
    id: "fixture-b",
    code: "TEST-ONLY-B",
    coffeeId: "fixture-editorial",
    profile: "Perfil técnico B",
    sortOrder: 1,
  },
  {
    ...sourceLot,
    id: "fixture-hidden-lot",
    code: "DRAFT-LOT-NEVER-PUBLISH",
    coffeeId: "fixture-editorial",
    status: "draft",
  },
);
for (const [id, lotId] of [
  ["a", "fixture-a"],
  ["a2", "fixture-a"],
  ["b", "fixture-b"],
])
  content.offers.push({
    id: `fixture-${id}`,
    lotId,
    status: "published",
    sku: `TEST-ONLY-${id.toUpperCase()}`,
    currency: "BRL",
    unitPriceInCents: null,
    availableQuantity: null,
    weightInGrams: null,
    grind: null,
  });
content.home = {
  ...content.home,
  title: "Seleção configurada de teste.",
  emphasis: "Sem contagem fixa.",
  featuredCoffeeIds: ["fixture-editorial", "samba"],
};
for (const name of ["coffees", "lots", "offers"]) {
  mkdirSync(join(root, "content", name), { recursive: true });
  for (const item of content[name as "coffees" | "lots" | "offers"])
    writeFileSync(
      join(root, "content", name, `${item.id}.json`),
      JSON.stringify(item),
    );
}
mkdirSync(join(root, "public/media"), { recursive: true });
writeFileSync(join(root, "content/home.json"), JSON.stringify(content.home));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
writeFileSync(image, png);
writeFileSync(join(root, "public/media/cms-fixture.png"), png);
const cleanEnv: NodeJS.ProcessEnv = {
  ...process.env,
  GITHUB_PAGES: "true",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete cleanEnv.CURA_CONTENT_ROOT;
function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} falhou (${result.status ?? result.signal})`,
    );
}
function assertNoDrafts(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) assertNoDrafts(file);
    else if (
      /\.(html|txt|js|json)$/.test(entry.name) &&
      /DRAFT-SENTINEL-NEVER-PUBLISH|DRAFT-LOT-NEVER-PUBLISH/.test(
        readFileSync(file, "utf8"),
      )
    )
      throw new Error(`Conteúdo privado vazou em ${file}`);
  }
}
let failure: unknown;
try {
  run("npm", ["run", "build"], { ...cleanEnv, CURA_CONTENT_ROOT: root });
  assertNoDrafts("out");
  run(
    "node",
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.scenarios.config.ts",
    ],
    cleanEnv,
  );
  // Exercise a genuinely empty editorial catalog, not just a filtered list.
  for (const name of ["coffees", "lots", "offers"]) {
    for (const file of readdirSync(join(root, "content", name)))
      rmSync(join(root, "content", name, file));
  }
  writeFileSync(
    join(root, "content/home.json"),
    JSON.stringify({ ...content.home, featuredCoffeeIds: [] }),
  );
  run("npm", ["run", "build"], { ...cleanEnv, CURA_CONTENT_ROOT: root });
  if (existsSync("out/cafes/_catalogo-vazio/index.html"))
    throw new Error("A rota técnica vazia não pode ser publicada como café");
  run("node", ["node_modules/@playwright/test/cli.js", "test"], {
    ...cleanEnv,
    CURA_CONTENT_ROOT: root,
  });
} catch (error) {
  failure = error;
} finally {
  rmSync(image, { force: true });
  rmSync(root, { recursive: true, force: true });
  // The final out/ must contain only the real editorial records, even after a failed scenario.
  run("npm", ["run", "build"], cleanEnv);
}
if (failure) {
  console.error(failure);
  process.exitCode = 1;
}
