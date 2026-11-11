// End-to-end purchase tests in an isolated test environment: the server build
// of the store, a test-only catalog with fictitious prices, PGlite as the
// database and local stand-ins for Asaas, Melhor Envio and Resend.
// Nothing here touches real providers, real prices or the published content.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMockProviders } from "./lib/mock-providers";
import { hashPassword } from "../lib/commerce/server/admin-auth";

const MOCK_PORT = 4300;
const STORE_PORT = 4310;
const storeUrl = `http://127.0.0.1:${STORE_PORT}`;
const mockUrl = `http://127.0.0.1:${MOCK_PORT}`;
const webhookToken = "token-de-teste-do-webhook-asaas";
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
  // Fictitious logistics, test only.
  grossWeightInGrams: Math.round(grams * 1.2),
  packageHeightCm: grams >= 1000 ? 30 : grams >= 500 ? 25 : 20,
  packageWidthCm: grams >= 1000 ? 15 : 12,
  packageLengthCm: grams >= 1000 ? 10 : 7,
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
    offer("a-1000", "teste-a-lote", 15000, 1000),
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
    shippingSubsidyCents: null,
    maxQuantityPerLine: 10,
    pixExpirationMinutes: 30,
    cardExpirationMinutes: 60,
    pixDiscountPercent: 5,
    cardFeeAssumptionPercent: 3,
    maxVolumeWeightGrams: 4000,
    packingFillFactor: 0.8,
    shippingServiceIds: ["1", "3"],
    // Test boxes with fictitious measures.
    boxes: [
      {
        id: "caixa-p",
        label: "Caixa P (teste)",
        innerHeightCm: 12,
        innerWidthCm: 16,
        innerLengthCm: 22,
        outerHeightCm: 13,
        outerWidthCm: 17,
        outerLengthCm: 23,
        tareGrams: 150,
      },
      {
        id: "caixa-g",
        label: "Caixa G (teste)",
        innerHeightCm: 20,
        innerWidthCm: 26,
        innerLengthCm: 32,
        outerHeightCm: 21,
        outerWidthCm: 27,
        outerLengthCm: 33,
        tareGrams: 300,
      },
    ],
  }),
);
mkdirSync(join(root, "public"), { recursive: true });

// A real key in the developer's shell must never reach the test store.
const inherited = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !/^(ASAAS_|MELHOR_ENVIO_|SHIPPING_|CURA_ALLOW_LIVE|ADMIN_|ANTHROPIC_|RESEND_|DATABASE_|POSTGRES_)/.test(
        key,
      ),
  ),
);
const env: NodeJS.ProcessEnv = {
  ...(inherited as NodeJS.ProcessEnv),
  NEXT_TELEMETRY_DISABLED: "1",
  CURA_TARGET: "server",
  CURA_COMMERCE: "enabled",
  CURA_CONTENT_ROOT: root,
  SITE_URL: storeUrl,
  DATABASE_URL: `pglite:${join(root, "db")}`,
  ORDER_TOKEN_SECRET: "segredo-de-teste-com-mais-de-32-caracteres",
  // Simulated sandbox credentials: never real keys in automated tests.
  ASAAS_ENVIRONMENT: "sandbox",
  ASAAS_API_KEY: "$aact_hmlg_chave_simulada",
  ASAAS_WEBHOOK_TOKEN: webhookToken,
  ASAAS_API_BASE: `${mockUrl}/v3`,
  MELHOR_ENVIO_ENVIRONMENT: "sandbox",
  MELHOR_ENVIO_TOKEN: "token-simulado",
  MELHOR_ENVIO_API_BASE: mockUrl,
  MELHOR_ENVIO_USER_AGENT: "Cura Cafe testes (loja@example.test)",
  // Fictitious origin and sender, test only.
  SHIPPING_ORIGIN_CEP: "00000000",
  SHIPPING_FROM_NAME: "Remetente de Teste",
  SHIPPING_FROM_DOCUMENT: "52998224725",
  SHIPPING_FROM_PHONE: "11999990000",
  SHIPPING_FROM_EMAIL: "envio@example.test",
  SHIPPING_FROM_STREET: "Rua de Teste",
  SHIPPING_FROM_NUMBER: "1",
  SHIPPING_FROM_DISTRICT: "Centro",
  SHIPPING_FROM_CITY: "Cidade de Teste",
  SHIPPING_FROM_STATE: "SP",
  SHIPPING_NON_COMMERCIAL: "true",
  ADMIN_PASSWORD_HASH: hashPassword("senha-de-teste-do-painel"),
  ADMIN_SESSION_SECRET: "segredo-de-sessao-do-painel-de-teste-123456",
  CRON_SECRET: "segredo-do-cron-de-teste",
  RESEND_API_KEY: "re_simulado",
  RESEND_API_BASE: mockUrl,
  EMAIL_FROM: "Cura Café <loja@example.test>",
  CEP_API_BASE: mockUrl,
  CURA_LOG: "silent",
  CURA_RATE_LIMIT_SCALE: "20",
};
delete env.GITHUB_PAGES;

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
      ["A-1000", "50"],
      ["B-250", "50"],
      ["C-250", "1"],
    ])
      run("npx", ["tsx", "scripts/ops.ts", "stock:set", sku, quantity]);
    mock = await startMockProviders({
      port: MOCK_PORT,
      storeUrl,
      webhookToken,
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
