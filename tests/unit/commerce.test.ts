import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { buildPriceBook, pricePer100g } from "../../lib/commerce/catalog";
import { normalizeCart, priceCart, skuDemand } from "../../lib/commerce/cart";
import { crossSell, largerPackage } from "../../lib/commerce/recommendations";
import { commerceRulesSchema } from "../../lib/commerce/rules";
import { readConfig } from "../../lib/commerce/server/config";
import { migrate, openDb, type Db } from "../../lib/commerce/server/db";
import { redact } from "../../lib/commerce/server/log";
import { brasiliaIso } from "../../lib/commerce/server/mercadopago";
import {
  availability,
  canReadOrder,
  CheckoutError,
  createCheckout,
  handleMercadoPagoNotification,
  markShipped,
  orderView,
  quoteShipping,
  reconcilePending,
  seedStockFromContent,
  type Deps,
} from "../../lib/commerce/server/orders";
import {
  rateLimit,
  isValidCpf,
  signMercadoPagoNotification,
  verifyMercadoPagoSignature,
} from "../../lib/commerce/server/security";
import {
  VALID_CPF,
  fakeNotifier,
  fakePayments,
  fakeShipping,
  fixtureContent,
} from "./commerce-fixtures";

process.env.CURA_LOG = "silent";
const book = buildPriceBook(fixtureContent());
const rules = commerceRulesSchema.parse({});
let db: Db;
let payments: ReturnType<typeof fakePayments>;
let shipping: ReturnType<typeof fakeShipping>;
let mail: ReturnType<typeof fakeNotifier>;
let deps: Deps;
beforeEach(async () => {
  db = await openDb("pglite:memory");
  await migrate(db);
  await db.query(
    "INSERT INTO inventory (sku, available) VALUES ('A-250', 5), ('A-500', 5), ('A-1000', 5), ('B-250', 2)",
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
  };
});
const checkout = (overrides: Record<string, unknown> = {}) => ({
  idempotencyKey: randomUUID(),
  lines: [{ id: "a-250", quantity: 2 }],
  customer: {
    name: "Maria Teste",
    email: "Maria@Example.com",
    cpf: "529.982.247-25",
    phone: "(11) 99999-0000",
  },
  address: {
    cep: "01310-100",
    street: "Rua Teste",
    number: "10",
    complement: "",
    district: "Centro",
    city: "São Paulo",
    state: "sp",
  },
  shippingOptionId: "1",
  consent: true,
  payment: { method: "pix" },
  ...overrides,
});
const stock = async (sku: string) =>
  (
    await db.query<{ available: number }>(
      "SELECT available FROM inventory WHERE sku = $1",
      [sku],
    )
  )[0].available;
const status = async (id: string) =>
  (
    await db.query<{ status: string }>(
      "SELECT status FROM orders WHERE id = $1",
      [id],
    )
  )[0].status;
const notify = (paymentId: string, requestId = randomUUID()) =>
  handleMercadoPagoNotification(deps, {
    requestId,
    type: "payment",
    dataId: paymentId,
  });
const rejects = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (error) => error instanceof CheckoutError && error.code === code,
  );

test("price book sells only published, priced items; kits need an approved price", () => {
  assert.deepEqual(Object.keys(book).sort(), [
    "a-1000",
    "a-250",
    "a-500",
    "b-250",
    "kit-teste",
  ]);
  assert.deepEqual(book["kit-teste"].skus, [
    { sku: "A-250", quantity: 1 },
    { sku: "B-250", quantity: 1 },
  ]);
  assert.equal(book["kit-teste"].weightGrams, 500);
  assert.equal(pricePer100g(book["a-250"]), 2000);
});
test("cart merges lines, caps quantities and drops unknown or unpriced items", () => {
  const { lines, removed } = normalizeCart(
    [
      { id: "a-250", quantity: 2 },
      { id: "a-250", quantity: 30 },
      { id: "b-sem-preco", quantity: 1 },
      { id: "inventado", quantity: 1 },
      { id: "b-250", quantity: 0 },
    ],
    book,
    rules,
  );
  assert.deepEqual(lines, [{ id: "a-250", quantity: 10 }]);
  assert.deepEqual(removed, ["b-sem-preco", "inventado", "b-250"]);
  const priced = priceCart(
    [
      { id: "kit-teste", quantity: 2 },
      { id: "a-500", quantity: 1 },
    ],
    book,
    {
      freeShippingFromCents: 30000,
    },
  );
  assert.equal(priced.subtotalCents, 30000);
  assert.equal(priced.weightGrams, 1500);
  assert.equal(priced.freeShipping, true);
  assert.deepEqual(Object.fromEntries(skuDemand(priced.lines)), {
    "A-250": 2,
    "B-250": 2,
    "A-500": 1,
  });
});
test("upsell suggests a bigger bag only when it costs less per 100 g", () => {
  assert.equal(largerPackage(book, book["a-250"])?.item.id, "a-500");
  // 1 kg costs more per 100 g than 500 g here, so it is never pushed.
  assert.equal(largerPackage(book, book["a-500"]), null);
  assert.deepEqual(
    crossSell(book, ["cafe-a"]).map((suggestion) => suggestion.item.id),
    ["kit-teste", "b-250"],
  );
});
test("Pix checkout creates one order, reserves stock and returns the QR code", async () => {
  const result = await createCheckout(deps, checkout());
  assert.equal(result!.status, "pending_payment");
  assert.equal(result!.subtotalCents, 10000);
  assert.equal(result!.shippingCents, 2290);
  assert.equal(result!.totalCents, 12290);
  assert.equal(result!.payment?.pix?.qrCode, "PIX-1000");
  assert.equal(await stock("A-250"), 3);
  assert.equal(payments.created[0].amountCents, 12290);
  assert.equal(
    payments.created[0].notificationUrl,
    "https://loja.test/api/webhooks/mercadopago/",
  );
  assert.equal(payments.created[0].payer.email, "maria@example.com");
  assert.ok(canReadOrder(deps, result!.id, result!.token!));
  assert.ok(!canReadOrder(deps, result!.id, "token-errado"));
  assert.equal(mail.sent[0].kind, "order_received");
  const view = JSON.stringify(await orderView(deps, result!.id));
  for (const secret of [VALID_CPF, "maria@example.com", "Rua Teste", "99999"])
    assert.ok(!view.includes(secret), `order view leaks ${secret}`);
});
test("prices and freight come from the server, not from the request", async () => {
  await rejects(
    createCheckout(deps, { ...checkout(), totalCents: 1 } as never),
    "invalid_input",
  );
  await rejects(
    createCheckout(deps, checkout({ shippingOptionId: "99" })),
    "shipping_changed",
  );
  await rejects(
    createCheckout(
      deps,
      checkout({ lines: [{ id: "b-sem-preco", quantity: 1 }] }),
    ),
    "item_unavailable",
  );
  const free = await quoteShipping(
    { ...deps, rules: { ...rules, freeShippingFromCents: 9000 } },
    {
      cep: "01310100",
      lines: [{ id: "a-250", quantity: 2 }],
    },
  );
  assert.deepEqual(
    free.options.map((option) => option.chargedCents),
    [0, 0],
  );
  assert.equal(shipping.calls.at(-1)?.weightGrams, 500);
  shipping.setDown(true);
  await rejects(
    quoteShipping(deps, {
      cep: "01310100",
      lines: [{ id: "a-250", quantity: 1 }],
    }),
    "shipping_unavailable",
  );
});
test("invalid customer data is refused before anything is created", async () => {
  assert.ok(isValidCpf(VALID_CPF));
  assert.ok(!isValidCpf("11111111111"));
  assert.ok(!isValidCpf("52998224724"));
  for (const bad of [
    checkout({ consent: false }),
    checkout({ customer: { ...checkout().customer, cpf: "123.456.789-00" } }),
    checkout({ address: { ...checkout().address, state: "XX" } }),
    checkout({ customer: { ...checkout().customer, name: "Maria" } }),
  ])
    await rejects(createCheckout(deps, bad), "invalid_input");
  assert.equal((await db.query("SELECT 1 FROM orders")).length, 0);
});
test("repeating a submission returns the same order; changing it is refused", async () => {
  const input = checkout();
  const first = await createCheckout(deps, input);
  const again = await createCheckout(deps, input);
  assert.equal(again!.id, first!.id);
  assert.equal(payments.created.length, 1);
  assert.equal(await stock("A-250"), 3);
  await rejects(
    createCheckout(deps, { ...input, lines: [{ id: "a-250", quantity: 1 }] }),
    "idempotency_conflict",
  );
  const [one, two] = await Promise.all([
    createCheckout(
      deps,
      checkout({ idempotencyKey: input.idempotencyKey }),
    ).catch(() => null),
    createCheckout(deps, input),
  ]);
  assert.equal(two!.id, first!.id);
  assert.equal(one?.id ?? first!.id, first!.id);
  assert.equal((await db.query("SELECT 1 FROM orders")).length, 1);
});
test("insufficient stock refuses the order and leaves stock untouched", async () => {
  await rejects(
    createCheckout(
      deps,
      checkout({ lines: [{ id: "kit-teste", quantity: 3 }] }),
    ),
    "insufficient_stock",
  );
  assert.equal(await stock("A-250"), 5);
  assert.equal(await stock("B-250"), 2);
  assert.equal((await db.query("SELECT 1 FROM orders")).length, 0);
  await db.query("DELETE FROM inventory WHERE sku = 'A-1000'");
  await rejects(
    createCheckout(deps, checkout({ lines: [{ id: "a-1000", quantity: 1 }] })),
    "insufficient_stock",
  );
  assert.deepEqual(await availability(deps, ["kit-teste", "a-250", "a-1000"]), {
    "kit-teste": 2,
    "a-250": 5,
    "a-1000": 0,
  });
});
test("a network failure creating the payment keeps the order; the retry pays it", async () => {
  const input = checkout();
  payments.failNext();
  await assert.rejects(createCheckout(deps, input), (error) => {
    assert.ok(
      error instanceof CheckoutError && error.code === "payment_unavailable",
    );
    assert.ok(error.details.orderId);
    return true;
  });
  assert.equal(payments.created.length, 0);
  assert.equal(await stock("A-250"), 3);
  const retry = await createCheckout(deps, input);
  assert.equal(retry!.payment?.pix?.qrCode, "PIX-1000");
  assert.equal(payments.created.length, 1);
});
test("approved webhook marks paid once; duplicates and replays change nothing", async () => {
  const order = await createCheckout(deps, checkout());
  payments.set("1000", { status: "approved" });
  const requestId = randomUUID();
  assert.deepEqual(await notify("1000", requestId), {
    processed: true,
    outcome: "paid",
  });
  assert.deepEqual(await notify("1000", requestId), {
    processed: false,
    reason: "duplicate",
  });
  assert.deepEqual(await notify("1000"), { processed: true, outcome: null });
  assert.equal(await status(order!.id), "paid");
  const events = await db.query<{ type: string }>(
    "SELECT type FROM order_events WHERE order_id = $1 ORDER BY id",
    [order!.id],
  );
  assert.deepEqual(
    events.map((row) => row.type),
    ["order.created", "order.paid"],
  );
  assert.deepEqual(
    mail.sent.map((message) => message.kind),
    ["order_received", "payment_confirmed"],
  );
  assert.equal(await stock("A-250"), 3);
  assert.equal((await orderView(deps, order!.id))!.payment?.pix, null);
});
test("a pending status in the browser never marks the order as paid", async () => {
  const order = await createCheckout(
    deps,
    checkout({
      payment: {
        method: "card",
        token: "tok-review",
        paymentMethodId: "visa",
        installments: 1,
      },
    }),
  );
  assert.equal(order!.status, "pending_payment");
  assert.equal(order!.payment?.status, "in_process");
  assert.deepEqual(await notify("1000"), { processed: true, outcome: null });
  assert.equal(await status(order!.id), "pending_payment");
});
test("approved card payment is paid immediately, from the server's own API call", async () => {
  const order = await createCheckout(
    deps,
    checkout({
      payment: {
        method: "card",
        token: "tok-approved",
        paymentMethodId: "master",
        installments: 3,
        issuerId: "24",
      },
    }),
  );
  assert.equal(order!.status, "paid");
  const request = payments.created[0];
  assert.ok(
    request.method === "card" &&
      request.installments === 3 &&
      request.issuerId === "24",
  );
});
test("rejected and expired payments release stock exactly once", async () => {
  const card = await createCheckout(
    deps,
    checkout({
      payment: {
        method: "card",
        token: "tok-reject",
        paymentMethodId: "visa",
        installments: 1,
      },
    }),
  );
  assert.equal(card!.status, "payment_failed");
  assert.equal(await stock("A-250"), 5);
  await notify("1000");
  assert.equal(await stock("A-250"), 5);
  const pix = await createCheckout(deps, checkout());
  assert.equal(await stock("A-250"), 3);
  payments.set("1001", { status: "cancelled" });
  await notify("1001");
  await notify("1001");
  assert.equal(await status(pix!.id), "cancelled");
  assert.equal(await stock("A-250"), 5);
  assert.equal(
    mail.sent.filter((message) => message.kind === "payment_failed").length,
    1,
  );
});
test("an approved payment with a different amount is not accepted as paid", async () => {
  const order = await createCheckout(deps, checkout());
  payments.set("1000", { status: "approved", amountCents: 100 });
  await notify("1000");
  assert.equal(await status(order!.id), "pending_payment");
  const events = await db.query<{ type: string }>(
    "SELECT type FROM order_events WHERE order_id = $1",
    [order!.id],
  );
  assert.ok(events.some((row) => row.type === "payment.amount_mismatch"));
});
test("webhook provider failure is retried; unknown orders are ignored", async () => {
  const order = await createCheckout(deps, checkout());
  const requestId = randomUUID();
  await assert.rejects(notify("404", requestId));
  payments.set("1000", { status: "approved" });
  await handleMercadoPagoNotification(deps, {
    requestId,
    type: "payment",
    dataId: "1000",
  });
  assert.equal(await status(order!.id), "paid");
  payments.store.set("2000", {
    ...payments.store.get("1000")!,
    id: "2000",
    externalReference: randomUUID(),
  });
  assert.deepEqual(await notify("2000"), {
    processed: false,
    reason: "unknown_order",
  });
  assert.deepEqual(
    await handleMercadoPagoNotification(deps, {
      requestId: randomUUID(),
      type: "merchant_order",
      dataId: "1",
    }),
    { processed: false, reason: "ignored_type" },
  );
});
test("reconciliation cancels unpaid orders and shipping requires a paid order", async () => {
  const input = checkout();
  payments.failNext();
  await createCheckout(deps, input).catch(() => null);
  const pix = await createCheckout(deps, checkout());
  await db.query("UPDATE orders SET created_at = now() - interval '2 hours'");
  payments.set("1000", { status: "expired" });
  const results = await reconcilePending(deps, 60);
  assert.deepEqual(Object.values(results).sort(), ["cancelled", "cancelled"]);
  assert.equal(await stock("A-250"), 5);
  assert.equal(
    await markShipped(deps, pix!.id, { code: "BR123", carrier: "Correios" }),
    false,
  );
  const paid = await createCheckout(
    deps,
    checkout({
      payment: {
        method: "card",
        token: "tok-approved",
        paymentMethodId: "visa",
        installments: 1,
      },
    }),
  );
  assert.equal(
    await markShipped(deps, paid!.id, { code: "BR123", carrier: "Correios" }),
    true,
  );
  assert.deepEqual((await orderView(deps, paid!.id))!.tracking, {
    code: "BR123",
    carrier: "Correios",
  });
  assert.equal(mail.sent.at(-1)?.kind, "order_shipped");
});
test("Mercado Pago signatures are verified with the webhook secret", () => {
  const signature = signMercadoPagoNotification("segredo", "123", "req-1");
  assert.ok(
    verifyMercadoPagoSignature({
      secret: "segredo",
      signature,
      requestId: "req-1",
      dataId: "123",
    }),
  );
  for (const tampered of [
    { secret: "outro", signature, requestId: "req-1", dataId: "123" },
    { secret: "segredo", signature, requestId: "req-2", dataId: "123" },
    { secret: "segredo", signature, requestId: "req-1", dataId: "124" },
    { secret: "segredo", signature: null, requestId: "req-1", dataId: "123" },
    {
      secret: "segredo",
      signature: "ts=1,v1=abc",
      requestId: "req-1",
      dataId: "123",
    },
  ])
    assert.ok(!verifyMercadoPagoSignature(tampered));
});
test("live charges need an explicit opt-in; logs never carry personal data", () => {
  const base = {
    CURA_COMMERCE: "enabled",
    SITE_URL: "https://loja.test",
    DATABASE_URL: "pglite:memory",
    ORDER_TOKEN_SECRET: "x".repeat(40),
    MP_ACCESS_TOKEN: "token",
    MP_WEBHOOK_SECRET: "segredo",
  };
  assert.equal(readConfig({ ...base }).payments, true);
  assert.equal(
    readConfig({ ...base, MP_ENVIRONMENT: "production" }).payments,
    false,
  );
  assert.equal(
    readConfig({
      ...base,
      MP_ENVIRONMENT: "production",
      CURA_ALLOW_LIVE_PAYMENTS: "true",
    }).payments,
    true,
  );
  assert.equal(
    readConfig({ ...base, ORDER_TOKEN_SECRET: "curto" }).enabled,
    false,
  );
  assert.equal(readConfig({ ...base }).shipping, false);
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
  assert.equal(
    brasiliaIso(new Date("2026-11-06T15:00:00.000Z")),
    "2026-11-06T12:00:00.000-03:00",
  );
});
test("rate limit blocks bursts per key and resets after the window", () => {
  const key = `teste-${randomUUID()}`;
  const results = Array.from({ length: 4 }, () =>
    rateLimit(key, 3, 60_000, 1000),
  );
  assert.deepEqual(results, [true, true, true, false]);
  assert.equal(rateLimit(key, 3, 60_000, 61_001), true);
  assert.equal(rateLimit(`outra-${key}`, 3, 60_000, 1000), true);
});
test("a webhook that fails while saving is processed again on the provider's retry", async () => {
  const order = await createCheckout(deps, checkout());
  payments.set("1000", { status: "approved" });
  const requestId = randomUUID();
  // Break persistence after the provider read succeeds.
  await db.query("ALTER TABLE payments RENAME TO payments_off");
  await assert.rejects(notify("1000", requestId));
  await db.query("ALTER TABLE payments_off RENAME TO payments");
  assert.equal(await status(order!.id), "pending_payment");
  assert.equal(
    (await db.query("SELECT 1 FROM webhook_events WHERE id = $1", [requestId]))
      .length,
    0,
  );
  assert.deepEqual(await notify("1000", requestId), {
    processed: true,
    outcome: "paid",
  });
  assert.equal(await status(order!.id), "paid");
  // A later refund still reaches a paid order through its own notification.
  payments.set("1000", { status: "refunded" });
  assert.deepEqual(await notify("1000"), {
    processed: true,
    outcome: "refunded",
  });
});
test("replayed notifications never move a shipped order backwards", async () => {
  const order = await createCheckout(deps, checkout());
  payments.set("1000", { status: "approved" });
  await notify("1000");
  assert.equal(
    await markShipped(deps, order!.id, { code: "BR1", carrier: "Correios" }),
    true,
  );
  for (const next of ["approved", "pending", "cancelled", "rejected"]) {
    payments.set("1000", { status: next });
    assert.deepEqual(await notify("1000"), { processed: true, outcome: null });
    assert.equal(await status(order!.id), "shipped");
  }
  assert.equal(
    await markShipped(deps, order!.id, { code: "BR2", carrier: "Correios" }),
    false,
  );
  assert.equal(await stock("A-250"), 3);
  payments.set("1000", { status: "refunded" });
  assert.deepEqual(await notify("1000"), {
    processed: true,
    outcome: "refunded",
  });
  payments.set("1000", { status: "approved" });
  assert.deepEqual(await notify("1000"), { processed: true, outcome: null });
  assert.equal(await status(order!.id), "refunded");
});
test("CMS stock seeds only SKUs without a stock row; Vercel variables are understood", async () => {
  await db.query("DELETE FROM inventory WHERE sku = 'B-250'");
  const seeded = await seedStockFromContent(db, [
    { sku: "A-250", availableQuantity: 99 },
    { sku: "B-250", availableQuantity: 7 },
    { sku: "X-1", availableQuantity: null },
  ]);
  assert.deepEqual(seeded, ["B-250"]);
  assert.equal(await stock("A-250"), 5);
  assert.equal(await stock("B-250"), 7);
  const config = readConfig({
    CURA_COMMERCE: "enabled",
    VERCEL_PROJECT_PRODUCTION_URL: "cura-cafe.vercel.app",
    POSTGRES_URL: "postgres://exemplo",
    ORDER_TOKEN_SECRET: "x".repeat(40),
  });
  assert.equal(config.enabled, true);
  assert.equal(config.siteUrl, "https://cura-cafe.vercel.app");
  assert.equal(config.databaseUrl, "postgres://exemplo");
  assert.equal(config.payments, false);
});
test("CEP lookup returns the address, null for unknown CEPs and fails loudly when down", async () => {
  const { lookupCep } = await import("../../lib/commerce/server/cep");
  const calls: string[] = [];
  const fake = (body: unknown, ok = true) =>
    (async (url: string) => {
      calls.push(url);
      return { ok, json: async () => body } as Response;
    }) as unknown as typeof fetch;
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
  assert.equal(calls[0], "https://cep.test/ws/01310100/json/");
  assert.equal(
    await lookupCep("00000000", { fetchImpl: fake({ erro: "true" }) }),
    null,
  );
  assert.equal(await lookupCep("123", { fetchImpl: fake({}) }), null);
  await assert.rejects(lookupCep("01310100", { fetchImpl: fake({}, false) }));
});
