// End-to-end purchase tests in an isolated test environment: the server build
// of the store, a test-only catalog with fictitious prices, PGlite as the
// database and local stand-ins for Mercado Pago, Melhor Envio and Resend.
// Nothing here touches real providers, real prices or the published content.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMockProviders } from "./lib/mock-providers";

const MOCK_PORT = 4300;
const STORE_PORT = 4310;
const storeUrl = `http://127.0.0.1:${STORE_PORT}`;
const mockUrl = `http://127.0.0.1:${MOCK_PORT}`;
const webhookSecret = "segredo-de-teste-do-webhook";
const root = mkdtempSync(join(tmpdir(), "cura-commerce-"));

const coffee = (id: string, name: string, sortOrder: number) => ({
  id,
  slug: id,
  name,
  description: "Café técnico usado apenas nos testes da loja.",
  status: "published",
  sortOrder,
  primaryLotId: `${id}-lote`,
  tone: "cura",
  media: null,
});
const lot = (coffeeId: string, profile: string) => ({
  id: `${coffeeId}-lote`,
  coffeeId,
  code: `TESTE-${coffeeId.slice(-1).toUpperCase()}`,
  status: "published",
  sortOrder: 0,
  profile,
  notes: ["Nota técnica"],
  producers: ["Produtor técnico"],
  preparations: ["Coado"],
  acidity: "Média",
  body: "Médio",
  score: 85,
  roast: "Média",
  origin: "Origem técnica de teste.",
  variety: null,
});
const offer = (id: string, lotId: string, price: number, grams: number) => ({
  id,
  lotId,
  status: "published",
  sku: id.toUpperCase(),
  currency: "BRL",
  unitPriceInCents: price,
  availableQuantity: null,
  weightInGrams: grams,
  grind: "Em grãos",
});
const content: Record<string, Record<string, unknown>[]> = {
  coffees: [
    coffee("teste-a", "CAFÉ TÉCNICO A", 0),
    coffee("teste-b", "CAFÉ TÉCNICO B", 1),
    coffee("teste-c", "CAFÉ TÉCNICO C", 2),
  ],
  lots: [
    lot("teste-a", "Perfil A"),
    lot("teste-b", "Perfil B"),
    lot("teste-c", "Perfil C"),
  ],
  offers: [
    offer("a-250", "teste-a-lote", 4500, 250),
    offer("a-500", "teste-a-lote", 8000, 500),
    offer("b-250", "teste-b-lote", 5200, 250),
    offer("c-250", "teste-c-lote", 6100, 250),
  ],
  bundles: [
    {
      id: "kit-teste",
      name: "Kit técnico A + B",
      description: "Kit usado apenas nos testes.",
      status: "published",
      sortOrder: 0,
      priceInCents: 9200,
      items: [
        { offerId: "a-250", quantity: 1 },
        { offerId: "b-250", quantity: 1 },
      ],
    },
  ],
};
for (const [name, records] of Object.entries(content)) {
  mkdirSync(join(root, "content", name), { recursive: true });
  for (const record of records)
    writeFileSync(
      join(root, "content", name, `${record.id}.json`),
      JSON.stringify(record),
    );
}
writeFileSync(
  join(root, "content/home.json"),
  JSON.stringify({
    eyebrow: "LOJA DE TESTE",
    title: "Seleção de teste.",
    emphasis: "Preços fictícios.",
    intro: "Catálogo técnico para homologação.",
    featuredCoffeeIds: ["teste-a", "teste-b"],
  }),
);
writeFileSync(
  join(root, "content/commerce.json"),
  JSON.stringify({
    freeShippingFromCents: null,
    maxQuantityPerLine: 10,
    pixExpirationMinutes: 30,
  }),
);
mkdirSync(join(root, "public"), { recursive: true });

const env: NodeJS.ProcessEnv = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  CURA_TARGET: "server",
  CURA_COMMERCE: "enabled",
  CURA_CONTENT_ROOT: root,
  SITE_URL: storeUrl,
  DATABASE_URL: `pglite:${join(root, "db")}`,
  ORDER_TOKEN_SECRET: "segredo-de-teste-com-mais-de-32-caracteres",
  MP_ENVIRONMENT: "sandbox",
  MP_ACCESS_TOKEN: "TEST-token-simulado",
  MP_WEBHOOK_SECRET: webhookSecret,
  MP_API_BASE: mockUrl,
  MELHOR_ENVIO_TOKEN: "token-simulado",
  MELHOR_ENVIO_API_BASE: mockUrl,
  MELHOR_ENVIO_USER_AGENT: "Cura Cafe testes (loja@example.test)",
  SHIPPING_ORIGIN_CEP: "37500000",
  SHIPPING_BOX_CM: "12x16x24",
  SHIPPING_TARE_GRAMS: "150",
  RESEND_API_KEY: "re_simulado",
  RESEND_API_BASE: mockUrl,
  EMAIL_FROM: "Cura Café <loja@example.test>",
  CEP_API_BASE: mockUrl,
  CURA_LOG: "silent",
  CURA_RATE_LIMIT_SCALE: "20",
};
delete env.GITHUB_PAGES;
delete env.MP_PUBLIC_KEY;
function run(
  command: string,
  args: string[],
  extra: Record<string, string> = {},
) {
  const result = spawnSync(command, args, {
    env: { ...env, ...extra },
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} falhou (${result.status})`);
}
async function waitFor(url: string, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Servidor não respondeu: ${url}`);
}
async function main() {
  let server: ChildProcess | null = null;
  let mock: { close: () => void } | null = null;
  let failure: unknown;
  try {
    run("npx", ["tsx", "scripts/validate-content.ts"]);
    run("npx", ["next", "build"]);
    run("npx", ["tsx", "scripts/ops.ts", "migrate"]);
    for (const [sku, quantity] of [
      ["A-250", "50"],
      ["A-500", "50"],
      ["B-250", "50"],
      ["C-250", "1"],
    ])
      run("npx", ["tsx", "scripts/ops.ts", "stock:set", sku, quantity]);
    mock = await startMockProviders({
      port: MOCK_PORT,
      storeUrl,
      webhookSecret,
    });
    // Own process group, so stopping it also stops the Next.js child.
    server = spawn(
      "npx",
      ["next", "start", "-p", String(STORE_PORT), "-H", "127.0.0.1"],
      { env, stdio: "inherit", detached: true },
    );
    await waitFor(`${storeUrl}/api/commerce/status/`);
    // Asynchronous, so the in-process provider stand-ins keep answering.
    const code = await new Promise<number | null>((resolve) =>
      spawn(
        "node",
        [
          "node_modules/@playwright/test/cli.js",
          "test",
          "--config",
          "playwright.commerce.config.ts",
        ],
        {
          env: {
            ...env,
            COMMERCE_STORE_URL: storeUrl,
            COMMERCE_MOCK_URL: mockUrl,
          },
          stdio: "inherit",
        },
      ).on("exit", resolve),
    );
    if (code !== 0) throw new Error(`Testes da loja falharam (${code})`);
  } catch (error) {
    failure = error;
  } finally {
    if (server?.pid) process.kill(-server.pid, "SIGTERM");
    mock?.close();
    rmSync(root, { recursive: true, force: true });
  }
  if (failure) {
    console.error(failure);
    process.exit(1);
  }
}
void main();
