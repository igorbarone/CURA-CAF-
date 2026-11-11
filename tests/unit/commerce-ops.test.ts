import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { buildPriceBook } from "../../lib/commerce/catalog";
import { commerceRulesSchema } from "../../lib/commerce/rules";
import {
  createSession,
  hashPassword,
  validSession,
  verifyPassword,
} from "../../lib/commerce/server/admin-auth";
import { asaasGateway, financialStatus } from "../../lib/commerce/server/asaas";
import { readConfig } from "../../lib/commerce/server/config";
import { migrate, openDb, type Db } from "../../lib/commerce/server/db";
import { indicators } from "../../lib/commerce/server/indicators";
import {
  buyLabel,
  refreshTracking,
  type LabelDeps,
} from "../../lib/commerce/server/labels";
import { redact } from "../../lib/commerce/server/log";
import {
  advanceFulfillment,
  CheckoutError,
  createCheckout,
  handleAsaasWebhook,
  orderView,
  quoteShipping,
  seedStockFromContent,
} from "../../lib/commerce/server/orders";
import {
  rateLimit,
  verifyWebhookToken,
} from "../../lib/commerce/server/security";
import { melhorEnvioGateway } from "../../lib/commerce/server/shipping";
import {
  adjustStock,
  setPaused,
  stockReport,
} from "../../lib/commerce/server/stock";
import {
  TEST_BOXES,
  fakeNotifier,
  fakePayments,
  fakeShipping,
  fixtureContent,
} from "./commerce-fixtures";

process.env.CURA_LOG = "silent";
const content = fixtureContent();
const book = buildPriceBook(content);
const rules = commerceRulesSchema.parse({
  pixDiscountPercent: 5,
  cardFeeAssumptionPercent: 3,
  shippingServiceIds: ["1", "3"],
  boxes: TEST_BOXES,
});
const sender = {
  name: "Remetente Teste",
  phone: "11999990000",
  email: "envio@example.test",
  document: "52998224725",
  street: "Rua Origem",
  number: "1",
  complement: "",
  district: "Centro",
  city: "Cidade Teste",
  state: "MG",
  postalCode: "00000000",
};
let db: Db;
let payments: ReturnType<typeof fakePayments>;
let shipping: ReturnType<typeof fakeShipping>;
let mail: ReturnType<typeof fakeNotifier>;
let deps: LabelDeps;
beforeEach(async () => {
  db = await openDb("pglite:memory");
  await migrate(db);
  await db.query(
    "INSERT INTO inventory (sku, available) VALUES ('A-250', 5), ('A-500', 5), ('A-1000', 10), ('B-250', 2)",
  );
  payments = fakePayments();
  shipping = fakeShipping();
  mail = fakeNotifier();
  deps = {
    db,
    book,
    rules,
    payments: payments.gateway,
    shipping: shipping.gateway,
    notifier: mail.notifier,
    siteUrl: "https://loja.test",
    tokenSecret: "x".repeat(40),
    labels: { sender, nonCommercial: false },
  };
});
async function paidOrder(
  lines = [{ id: "a-250", quantity: 2 }],
  method: "pix" | "card" = "pix",
) {
  const quote = await quoteShipping(deps, { cep: "01310100", lines });
  const view = await createCheckout(deps, {
    idempotencyKey: randomUUID(),
    lines,
    customer: {
      name: "Maria Teste",
      email: "maria@example.test",
      cpf: "52998224725",
      phone: "11999990000",
    },
    address: {
      cep: "01310100",
      street: "Rua Teste",
      number: "10",
      complement: "",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
    },
    shippingOptionId: "1",
    shippingPriceCents: quote.options.find((o) => o.id === "1")!.chargedCents,
    consent: true,
    payment: { method },
  });
  const payment = [...payments.store.values()].find(
    (p) => p.externalReference === view!.id,
  )!;
  payments.set(payment.id, { status: "RECEIVED" });
  await handleAsaasWebhook(deps, {
    eventId: randomUUID(),
    event: "PAYMENT_RECEIVED",
    paymentId: payment.id,
  });
  return view!;
}
const rejects = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (error) => error instanceof CheckoutError && error.code === code,
  );
const fulfillment = async (id: string) =>
  (
    await db.query<{ fulfillment_status: string; status: string }>(
      "SELECT fulfillment_status, status FROM orders WHERE id = $1",
      [id],
    )
  )[0];

test("logistics status is separate from payment and only moves forward", async () => {
  const unpaid = await createCheckout(deps, {
    idempotencyKey: randomUUID(),
    lines: [{ id: "a-250", quantity: 1 }],
    customer: {
      name: "João Teste",
      email: "j@example.test",
      cpf: "52998224725",
      phone: "11999990000",
    },
    address: {
      cep: "01310100",
      street: "R",
      number: "1",
      complement: "",
      district: "C",
      city: "S",
      state: "SP",
    },
    shippingOptionId: "1",
    shippingPriceCents: (
      await quoteShipping(deps, {
        cep: "01310100",
        lines: [{ id: "a-250", quantity: 1 }],
      })
    ).options[0].chargedCents,
    consent: true,
    payment: { method: "pix" },
  });
  await rejects(
    advanceFulfillment(deps, unpaid!.id, "preparing"),
    "invalid_transition",
  );
  const order = await paidOrder();
  assert.equal((await orderView(deps, order.id))!.status, "paid");
  await advanceFulfillment(deps, order.id, "preparing");
  assert.equal((await orderView(deps, order.id))!.status, "preparing");
  await rejects(advanceFulfillment(deps, order.id, "shipped"), "invalid_input");
  await advanceFulfillment(deps, order.id, "shipped", {
    code: "BR123",
    carrier: "Correios",
  });
  await rejects(
    advanceFulfillment(deps, order.id, "preparing"),
    "invalid_transition",
  );
  // Replayed payment events never touch logistics.
  const payment = [...payments.store.values()].find(
    (p) => p.externalReference === order.id,
  )!;
  await handleAsaasWebhook(deps, {
    eventId: randomUUID(),
    event: "PAYMENT_RECEIVED",
    paymentId: payment.id,
  });
  assert.deepEqual(await fulfillment(order.id), {
    fulfillment_status: "shipped",
    status: "paid",
  });
  await advanceFulfillment(deps, order.id, "delivered");
  const view = await orderView(deps, order.id);
  assert.equal(view!.status, "delivered");
  assert.deepEqual(view!.tracking, { code: "BR123", carrier: "Correios" });
  assert.ok(mail.sent.some((m) => m.kind === "order_shipped"));
});
test("labels: explicit purchase, one per volume, bought once, resumable after a failure", async () => {
  const order = await paidOrder([{ id: "a-1000", quantity: 4 }]);
  const volumes = (
    await db.query<{ volumes: unknown[] }>(
      "SELECT volumes FROM orders WHERE id = $1",
      [order.id],
    )
  )[0].volumes.length;
  assert.ok(volumes >= 2);
  // No NF-e key and no content declaration authorised: refused.
  await rejects(
    buyLabel(deps, order.id, { invoiceKey: null }),
    "invalid_input",
  );
  // Fails at "generate" after paying: the retry must not pay again.
  shipping.failAt("generate");
  const failed = await buyLabel(deps, order.id, { invoiceKey: "3".repeat(44) });
  assert.equal(failed.status, "purchased");
  assert.ok(failed.error);
  assert.equal(shipping.carts.length, volumes);
  assert.equal(shipping.purchased.length, 1);
  shipping.failAt(null);
  const done = await buyLabel(deps, order.id, { invoiceKey: "3".repeat(44) });
  assert.equal(done.status, "generated");
  assert.equal(shipping.carts.length, volumes);
  assert.equal(shipping.purchased.length, 1);
  assert.ok(done.label_url);
  // A second click returns the existing label.
  const again = await buyLabel(deps, order.id, { invoiceKey: "3".repeat(44) });
  assert.equal(again.status, "generated");
  assert.equal(shipping.purchased.length, 1);
  assert.equal(shipping.carts[0].from.postalCode, sender.postalCode);
  assert.equal(shipping.carts[0].to.document, "52998224725");
  assert.equal((await fulfillment(order.id)).fulfillment_status, "preparing");
  await refreshTracking(deps, order.id);
  assert.equal((await fulfillment(order.id)).fulfillment_status, "shipped");
  // Unpaid orders never get a label; without sender data there are none.
  await rejects(
    buyLabel({ ...deps, labels: null }, order.id, { invoiceKey: null }),
    "shipping_unavailable",
  );
});
test("simultaneous label clicks buy one label", async () => {
  const order = await paidOrder();
  const nonCommercial = { ...deps, labels: { sender, nonCommercial: true } };
  await Promise.all([
    buyLabel(nonCommercial, order.id, { invoiceKey: null }),
    buyLabel(nonCommercial, order.id, { invoiceKey: null }),
  ]);
  assert.equal(shipping.purchased.length, 1);
  assert.equal(shipping.carts[0].nonCommercial, true);
});
test("stock adjustments are audited; pause hides the SKU; the report shows holds and sales", async () => {
  const skus = content.offers.map((o) => o.sku);
  assert.deepEqual(
    await adjustStock(
      db,
      { sku: "A-250", delta: 3, reason: "lote torrado", actor: "painel" },
      skus,
    ),
    { sku: "A-250", before: 5, after: 8 },
  );
  await assert.rejects(
    adjustStock(db, { sku: "A-250", set: -1, reason: "x", actor: "p" }, skus),
  );
  await assert.rejects(
    adjustStock(
      db,
      { sku: "INEXISTENTE", set: 1, reason: "x", actor: "p" },
      skus,
    ),
  );
  await assert.rejects(
    adjustStock(db, { sku: "A-250", set: 1, reason: " ", actor: "p" }, skus),
  );
  await setPaused(db, "B-250", true, "painel", skus);
  const log = await db.query<{ reason: string; actor: string }>(
    "SELECT reason, actor FROM inventory_adjustments ORDER BY id",
  );
  assert.deepEqual(log, [
    { reason: "lote torrado", actor: "painel" },
    { reason: "venda pausada", actor: "painel" },
  ]);
  await paidOrder();
  const report = await stockReport(db, content, book);
  const a = report.find((r) => r.sku === "A-250")!;
  assert.equal(a.sold, 2);
  assert.equal(a.available, 6);
  assert.ok(report.find((r) => r.sku === "B-250")!.paused);
  assert.deepEqual(report.find((r) => r.sku === "B-SEM-PRECO")!.issues, [
    "sem preço",
  ]);
});
test("indicators: paid orders, revenue, Pix discounts, freight, estimated card fees, average ticket", async () => {
  const pix = await paidOrder();
  const card = await paidOrder([{ id: "a-500", quantity: 1 }], "card");
  const result = await indicators(db, rules, { days: 30 });
  assert.equal(result.paidOrders, 2);
  assert.equal(result.pixOrders, 1);
  assert.equal(result.grossCents, pix.totalCents + card.totalCents);
  assert.equal(result.pixDiscountCents, 500);
  assert.equal(
    result.shippingChargedCents,
    pix.shippingCents + card.shippingCents,
  );
  assert.equal(
    result.estimatedCardFeesCents,
    Math.round(card.totalCents * 0.03),
  );
  assert.equal(result.averageTicketCents, Math.round(result.grossCents / 2));
  assert.equal(result.toShip, 2);
});
test("configuration: sandbox by default, live charges need explicit approval, keys must match", () => {
  const base = {
    CURA_COMMERCE: "enabled",
    SITE_URL: "https://loja.test",
    DATABASE_URL: "pglite:memory",
    ORDER_TOKEN_SECRET: "x".repeat(40),
    ASAAS_API_KEY: "$aact_hmlg_chave_de_teste",
    ASAAS_WEBHOOK_TOKEN: "t".repeat(32),
  };
  const sandbox = readConfig(base);
  assert.equal(sandbox.payments, true);
  assert.equal(sandbox.environment, "sandbox");
  assert.equal(sandbox.asaas.base, "https://api-sandbox.asaas.com/v3");
  const prodKey = { ...base, ASAAS_API_KEY: "$aact_prod_chave" };
  assert.equal(
    readConfig(prodKey).paymentsBlockedReason,
    "asaas_key_environment_mismatch",
  );
  assert.equal(
    readConfig({ ...prodKey, ASAAS_ENVIRONMENT: "production" })
      .paymentsBlockedReason,
    "live_payments_not_authorized",
  );
  assert.equal(
    readConfig({
      ...prodKey,
      ASAAS_ENVIRONMENT: "production",
      CURA_ALLOW_LIVE_PAYMENTS: "true",
    }).payments,
    true,
  );
  assert.equal(
    readConfig({ ...base, ASAAS_WEBHOOK_TOKEN: "curto" }).payments,
    false,
  );
  assert.equal(
    readConfig({ ...base, ORDER_TOKEN_SECRET: "curto" }).enabled,
    false,
  );
  // Freight needs token, User-Agent and the origin CEP; labels the sender.
  const shippingEnv = {
    ...base,
    MELHOR_ENVIO_TOKEN: "t",
    MELHOR_ENVIO_USER_AGENT: "Cura (a@b.c)",
  };
  assert.equal(readConfig(shippingEnv).shipping, false);
  assert.equal(
    readConfig({ ...shippingEnv, SHIPPING_ORIGIN_CEP: "37000000" }).shipping,
    true,
  );
  assert.equal(
    readConfig({ ...shippingEnv, SHIPPING_ORIGIN_CEP: "37000000" }).labels,
    false,
  );
  assert.equal(
    readConfig(shippingEnv).melhorEnvio.base,
    "https://sandbox.melhorenvio.com.br",
  );
  const vercel = readConfig({
    CURA_COMMERCE: "enabled",
    VERCEL_PROJECT_PRODUCTION_URL: "cura-cafe.vercel.app",
    POSTGRES_URL: "postgres://exemplo",
    ORDER_TOKEN_SECRET: "x".repeat(40),
  });
  assert.equal(vercel.siteUrl, "https://cura-cafe.vercel.app");
  assert.equal(vercel.databaseUrl, "postgres://exemplo");
  assert.equal(vercel.payments, false);
  assert.equal(vercel.admin.enabled, false);
});
test("webhook token, admin password and admin session are verified safely", () => {
  assert.ok(verifyWebhookToken("segredo-do-webhook", "segredo-do-webhook"));
  assert.ok(!verifyWebhookToken("segredo-do-webhook", "outro"));
  assert.ok(!verifyWebhookToken("", ""));
  assert.ok(!verifyWebhookToken("segredo", null));
  const hash = hashPassword("senha-forte-do-painel");
  assert.ok(hash.startsWith("scrypt$"));
  assert.ok(!hash.includes("senha-forte"));
  assert.ok(verifyPassword("senha-forte-do-painel", hash));
  assert.ok(!verifyPassword("senha-errada", hash));
  assert.ok(!verifyPassword("x", "texto-puro"));
  const secret = "s".repeat(40);
  const session = createSession(secret, 1000);
  assert.ok(validSession(secret, session, 2000));
  assert.ok(!validSession(secret, session, 1000 + 9 * 3600_000));
  assert.ok(!validSession("o".repeat(40), session, 2000));
  assert.ok(!validSession(secret, session.replace(/^\d/, "9"), 2000));
  assert.ok(!validSession(secret, undefined));
});
test("Asaas client: access_token header, charge reused by externalReference, Pix QR and hosted card page", async () => {
  const calls: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  }[] = [];
  const responses: Record<string, unknown> = {
    "GET /payments?externalReference=pedido-1&limit=10": { data: [] },
    "GET /customers?cpfCnpj=52998224725&limit=1": { data: [] },
    "POST /customers": { id: "cus_1" },
    "POST /payments": {
      id: "pay_1",
      status: "PENDING",
      value: 95.5,
      billingType: "PIX",
      externalReference: "pedido-1",
    },
    "GET /payments/pay_1/pixQrCode": {
      encodedImage: "IMG",
      payload: "PIX-COPIA-E-COLA",
    },
  };
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const path = url.replace("https://asaas.test/v3", "");
    calls.push({
      url: path,
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : null,
    });
    const body = responses[`${init.method ?? "GET"} ${path}`];
    return {
      ok: !!body,
      status: body ? 200 : 404,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  const gateway = asaasGateway({
    base: "https://asaas.test/v3",
    apiKey: "$aact_hmlg_x",
    userAgent: "Cura",
    fetchImpl,
  });
  const pix = await gateway.create({
    orderId: "pedido-1",
    amountCents: 9550,
    description: "Pedido",
    method: "pix",
    dueDate: "2026-11-11",
    customer: {
      name: "Maria Teste",
      email: "m@example.test",
      cpf: "52998224725",
      phone: "11999990000",
    },
    successUrl: "https://loja.test/pedido/",
  });
  assert.deepEqual(pix.pix, {
    payload: "PIX-COPIA-E-COLA",
    encodedImage: "IMG",
  });
  assert.equal(pix.amountCents, 9550);
  assert.ok(calls.every((c) => c.headers.access_token === "$aact_hmlg_x"));
  const charge = calls.find(
    (c) => c.method === "POST" && c.url === "/payments",
  )!;
  assert.deepEqual(charge.body, {
    customer: "cus_1",
    billingType: "PIX",
    value: 95.5,
    dueDate: "2026-11-11",
    description: "Pedido",
    externalReference: "pedido-1",
  });
  assert.equal(
    (
      calls.find((c) => c.url === "/customers")!.body as {
        notificationDisabled: boolean;
      }
    ).notificationDisabled,
    true,
  );
  // A retry finds the existing charge instead of creating another.
  responses["GET /payments?externalReference=pedido-1&limit=10"] = {
    data: [
      {
        id: "pay_1",
        status: "PENDING",
        value: 95.5,
        billingType: "PIX",
        externalReference: "pedido-1",
      },
    ],
  };
  const before = calls.filter((c) => c.method === "POST").length;
  assert.equal(
    (
      await gateway.create({
        orderId: "pedido-1",
        amountCents: 9550,
        description: "Pedido",
        method: "pix",
        dueDate: "2026-11-11",
        customer: {
          name: "Maria Teste",
          email: "m@example.test",
          cpf: "52998224725",
          phone: "11999990000",
        },
        successUrl: "https://loja.test/pedido/",
      })
    ).id,
    "pay_1",
  );
  assert.equal(calls.filter((c) => c.method === "POST").length, before);
  // Card: CREDIT_CARD with the hosted page and a return link, no card fields.
  responses["GET /payments?externalReference=pedido-2&limit=10"] = { data: [] };
  responses["GET /customers?cpfCnpj=52998224725&limit=1"] = {
    data: [{ id: "cus_1" }],
  };
  responses["POST /payments"] = {
    id: "pay_2",
    status: "PENDING",
    value: 100,
    billingType: "CREDIT_CARD",
    invoiceUrl: "https://asaas.test/i/pay_2",
    externalReference: "pedido-2",
  };
  const card = await gateway.create({
    orderId: "pedido-2",
    amountCents: 10000,
    description: "Pedido",
    method: "card",
    dueDate: "2026-11-11",
    customer: {
      name: "Maria Teste",
      email: "m@example.test",
      cpf: "52998224725",
      phone: "11999990000",
    },
    successUrl: "https://loja.test/pedido/?id=2",
  });
  assert.equal(card.invoiceUrl, "https://asaas.test/i/pay_2");
  const cardBody = calls
    .filter((c) => c.method === "POST" && c.url === "/payments")
    .at(-1)!.body as Record<string, unknown>;
  assert.equal(cardBody.billingType, "CREDIT_CARD");
  assert.deepEqual(cardBody.callback, {
    successUrl: "https://loja.test/pedido/?id=2",
    autoRedirect: true,
  });
  assert.ok(!("creditCard" in cardBody));
  assert.equal((await gateway.get("pay_inexistente")).status, "DELETED");
  assert.equal(financialStatus("RECEIVED"), "paid");
  assert.equal(financialStatus("CONFIRMED"), "paid");
  assert.equal(financialStatus("OVERDUE"), "expired");
  assert.equal(financialStatus("PENDING"), null);
  assert.equal(financialStatus("CHARGEBACK_REQUESTED"), null);
});
test("Melhor Envio client: one quote per volume with package, services and User-Agent", async () => {
  const bodies: Record<string, unknown>[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    bodies.push({ ...body, headers: init.headers });
    const weight = body.package.weight;
    return {
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 1,
          name: "PAC",
          price: (10 + weight).toFixed(2),
          delivery_time: 6,
          company: { name: "Correios" },
        },
        {
          id: 3,
          name: ".Package",
          price: (9 + weight).toFixed(2),
          delivery_time: 4,
          company: { name: "Jadlog" },
        },
      ],
    } as Response;
  }) as unknown as typeof fetch;
  const gateway = melhorEnvioGateway({
    base: "https://me.test",
    token: "tok",
    userAgent: "Cura (a@b.c)",
    originCep: "37.000-000",
    fetchImpl,
  });
  const volume = (weightGrams: number) => ({
    box: { id: "caixa-p", label: "P" },
    heightCm: 13,
    widthCm: 17,
    lengthCm: 23,
    weightGrams,
    insuranceCents: 10000,
    items: [],
  });
  const options = await gateway.quote({
    toCep: "20040-020",
    volumes: [volume(2000), volume(1000)],
    services: ["1", "3"],
  });
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[0].package, {
    height: 13,
    width: 17,
    length: 23,
    weight: 2,
  });
  assert.deepEqual(bodies[0].from, { postal_code: "37000000" });
  assert.equal(bodies[0].services, "1,3");
  assert.equal(
    (bodies[0].options as { insurance_value: number }).insurance_value,
    100,
  );
  assert.equal(
    (bodies[0].headers as Record<string, string>)["User-Agent"],
    "Cura (a@b.c)",
  );
  assert.deepEqual(
    options.map((o) => [o.name, o.priceCents, o.volumes]),
    [
      [".Package", 2100, 2],
      ["PAC", 2300, 2],
    ],
  );
});
test("live charges never run in tests; logs never carry personal data; rate limit holds", () => {
  assert.deepEqual(
    redact({
      orderId: "1",
      customer: { email: "a@b.c", cpf: "1" },
      token: "t",
    }),
    {
      orderId: "1",
      customer: { email: "[redacted]", cpf: "[redacted]" },
      token: "[redacted]",
    },
  );
  const key = `teste-${randomUUID()}`;
  assert.deepEqual(
    Array.from({ length: 4 }, () => rateLimit(key, 3, 60_000, 1000)),
    [true, true, true, false],
  );
  assert.equal(rateLimit(key, 3, 60_000, 61_001), true);
  // No real Asaas key may be present while the unit tests run.
  assert.ok(!(process.env.ASAAS_API_KEY ?? "").includes("_prod_"));
});
test("CMS stock seeds only SKUs without a stock row", async () => {
  await db.query("DELETE FROM inventory WHERE sku = 'B-250'");
  assert.deepEqual(
    await seedStockFromContent(db, [
      { sku: "A-250", availableQuantity: 99 },
      { sku: "B-250", availableQuantity: 7 },
      { sku: "X-1", availableQuantity: null },
    ]),
    ["B-250"],
  );
});
test("CEP lookup returns the address, null for unknown CEPs and fails loudly when down", async () => {
  const { lookupCep } = await import("../../lib/commerce/server/cep");
  const fake = (body: unknown, ok = true) =>
    (async () =>
      ({ ok, json: async () => body }) as Response) as unknown as typeof fetch;
  assert.deepEqual(
    await lookupCep("01310-100", {
      base: "https://cep.test",
      fetchImpl: fake({
        logradouro: "Avenida Paulista",
        bairro: "Bela Vista",
        localidade: "São Paulo",
        uf: "SP",
      }),
    }),
    {
      street: "Avenida Paulista",
      district: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    },
  );
  assert.equal(
    await lookupCep("00000000", { fetchImpl: fake({ erro: "true" }) }),
    null,
  );
  await assert.rejects(lookupCep("01310100", { fetchImpl: fake({}, false) }));
});
