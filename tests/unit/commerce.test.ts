import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import {
  buildPriceBook,
  onSale,
  pricePer100g,
  sellabilityIssues,
} from "../../lib/commerce/catalog";
import { normalizeCart, priceCart, skuDemand } from "../../lib/commerce/cart";
import { packCart, PackingError } from "../../lib/commerce/packing";
import {
  chargedShippingCents,
  orderTotals,
  pixDiscountCents,
} from "../../lib/commerce/pricing";
import { crossSell, largerPackage } from "../../lib/commerce/recommendations";
import { commerceRulesSchema } from "../../lib/commerce/rules";
import { migrate, openDb, type Db } from "../../lib/commerce/server/db";
import {
  availability,
  canReadOrder,
  CheckoutError,
  createCheckout,
  expireOverdue,
  handleAsaasWebhook,
  orderView,
  quoteShipping,
  reconcile,
  type Deps,
} from "../../lib/commerce/server/orders";
import { combineQuotes } from "../../lib/commerce/server/shipping";
import { isValidCpf } from "../../lib/commerce/server/security";
import { contentSchema, offerExtras } from "../../lib/content-schema";
import {
  TEST_BOXES,
  VALID_CPF,
  fakeNotifier,
  fakePayments,
  fakeShipping,
  fixtureContent,
} from "./commerce-fixtures";

process.env.CURA_LOG = "silent";
const book = buildPriceBook(fixtureContent());
const rules = commerceRulesSchema.parse({
  pixDiscountPercent: 5,
  cardFeeAssumptionPercent: 3,
  shippingServiceIds: ["1", "3"],
  boxes: TEST_BOXES,
});
let db: Db;
let payments: ReturnType<typeof fakePayments>;
let shipping: ReturnType<typeof fakeShipping>;
let mail: ReturnType<typeof fakeNotifier>;
let deps: Deps;
let clock: Date;
beforeEach(async () => {
  db = await openDb("pglite:memory");
  await migrate(db);
  await db.query(
    "INSERT INTO inventory (sku, available) VALUES ('A-250', 5), ('A-500', 5), ('A-1000', 10), ('B-250', 2)",
  );
  payments = fakePayments();
  shipping = fakeShipping();
  mail = fakeNotifier();
  clock = new Date();
  deps = {
    db,
    book,
    rules,
    payments: payments.gateway,
    shipping: shipping.gateway,
    notifier: mail.notifier,
    siteUrl: "https://loja.test",
    tokenSecret: "x".repeat(40),
    now: () => clock,
  };
});
const address = {
  cep: "01310-100",
  street: "Rua Teste",
  number: "10",
  complement: "",
  district: "Centro",
  city: "São Paulo",
  state: "sp",
};
const lines = [{ id: "a-250", quantity: 2 }];
// Builds a checkout body with the freight the server quotes right now, as
// the checkout screen would.
async function checkout(overrides: Record<string, unknown> = {}) {
  const body = {
    idempotencyKey: randomUUID(),
    lines,
    customer: {
      name: "Maria Teste",
      email: "Maria@Example.com",
      cpf: "529.982.247-25",
      phone: "(11) 99999-0000",
    },
    address,
    shippingOptionId: "1",
    consent: true,
    payment: { method: "pix" },
    ...overrides,
  } as Record<string, unknown> & { lines: unknown; address: typeof address };
  if (!("shippingPriceCents" in overrides)) {
    const quote = await quoteShipping(deps, {
      cep: body.address.cep,
      lines: body.lines,
    }).catch(() => null);
    body.shippingPriceCents =
      quote?.options.find((o) => o.id === body.shippingOptionId)
        ?.chargedCents ?? 0;
  }
  return body;
}
const stock = async (sku: string) =>
  (
    await db.query<{ available: number }>(
      "SELECT available FROM inventory WHERE sku = $1",
      [sku],
    )
  )[0].available;
const row = async (id: string) =>
  (
    await db.query<{
      status: string;
      fulfillment_status: string;
      stock_released: boolean;
    }>("SELECT * FROM orders WHERE id = $1", [id])
  )[0];
const webhook = (
  event: string,
  paymentId: string,
  eventId: string = randomUUID(),
) => handleAsaasWebhook(deps, { eventId, event, paymentId });
const rejects = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (error) => error instanceof CheckoutError && error.code === code,
  );
const paymentOf = (orderId: string) =>
  [...payments.store.values()].find((p) => p.externalReference === orderId)!;

// ---------- catalog -----------------------------------------------------
test("price book sells only published variants with price, SKU and shipping data", () => {
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
  assert.equal(book["kit-teste"].packing.length, 2);
  assert.equal(pricePer100g(book["a-250"]), 2000);
  // A published variant without gross weight or package size is not sold,
  // and the reason is reported.
  const content = fixtureContent();
  const offer = {
    ...content.offers.find((item) => item.id === "a-250")!,
    grossWeightInGrams: null,
    packageHeightCm: null,
    packageWidthCm: null,
    packageLengthCm: null,
  };
  assert.deepEqual(sellabilityIssues(content, offer), [
    "sem peso bruto embalado",
    "sem dimensões da embalagem",
  ]);
  assert.deepEqual(
    sellabilityIssues(content, { ...offer, status: "draft" })[0],
    "oferta não publicada",
  );
  const blocked = buildPriceBook({
    ...content,
    offers: content.offers.map((item) => (item.id === "a-250" ? offer : item)),
  });
  assert.equal(blocked["a-250"], undefined);
  // The kit needs every item sellable.
  assert.equal(blocked["kit-teste"], undefined);
});
test("drafts may be incomplete; inconsistent published data is refused by the schema", () => {
  const content = fixtureContent();
  const offer = (patch: Record<string, unknown>) => ({
    ...content.offers[0],
    ...patch,
  });
  const parse = (o: unknown) =>
    contentSchema.safeParse({ ...content, offers: [o], bundles: [] }).success;
  assert.ok(
    parse({
      id: "rascunho",
      lotId: "cafe-a-lote",
      status: "draft",
      sku: "RASCUNHO",
      currency: "BRL",
      unitPriceInCents: null,
      availableQuantity: null,
      weightInGrams: null,
      grind: null,
      ...offerExtras,
    }),
  );
  assert.ok(!parse(offer({ promoPriceInCents: 999999 })));
  assert.ok(!parse(offer({ minQuantity: 5, maxQuantity: 2 })));
  assert.ok(!parse(offer({ packageWidthCm: null })));
  assert.ok(!parse(offer({ grossWeightInGrams: 100 })));
  assert.ok(
    !parse(offer({ saleStartsAt: "2026-12-01", saleEndsAt: "2026-11-01" })),
  );
});
test("promotional price, quantity limits and sale windows apply to the variant", () => {
  const content = fixtureContent();
  const promo = buildPriceBook({
    ...content,
    offers: content.offers.map((item) =>
      item.id === "a-250"
        ? {
            ...item,
            promoPriceInCents: 4500,
            maxQuantity: 3,
            minQuantity: 2,
            saleStartsAt: "2026-11-10",
            saleEndsAt: "2026-11-20",
          }
        : item,
    ),
  });
  assert.equal(promo["a-250"].unitPriceCents, 4500);
  assert.equal(promo["a-250"].listPriceCents, 5000);
  assert.ok(onSale(promo["a-250"], new Date("2026-11-15T12:00:00Z")));
  assert.ok(!onSale(promo["a-250"], new Date("2026-11-21T12:00:00Z")));
  // Before 03:00 UTC it is still the previous day in Brasília.
  assert.ok(!onSale(promo["a-250"], new Date("2026-11-10T02:00:00Z")));
  const during = new Date("2026-11-15T12:00:00Z");
  assert.deepEqual(
    normalizeCart([{ id: "a-250", quantity: 9 }], promo, rules, during).lines,
    [{ id: "a-250", quantity: 3 }],
  );
  assert.deepEqual(
    normalizeCart([{ id: "a-250", quantity: 1 }], promo, rules, during).lines,
    [{ id: "a-250", quantity: 2 }],
  );
  assert.deepEqual(
    normalizeCart(
      [{ id: "a-250", quantity: 1 }],
      promo,
      rules,
      new Date("2026-12-01T12:00:00Z"),
    ).removed,
    ["a-250"],
  );
});
test("cart merges lines, caps quantities and drops unknown or unpriced items", () => {
  const { lines: merged, removed } = normalizeCart(
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
  assert.deepEqual(merged, [{ id: "a-250", quantity: 10 }]);
  assert.deepEqual(removed, ["b-sem-preco", "inventado", "b-250"]);
  const priced = priceCart(
    [
      { id: "kit-teste", quantity: 2 },
      { id: "a-500", quantity: 1 },
    ],
    book,
    { freeShippingFromCents: 30000 },
  );
  assert.equal(priced.subtotalCents, 30000);
  assert.equal(priced.freeShipping, true);
  assert.deepEqual(Object.fromEntries(skuDemand(priced.lines)), {
    "A-250": 2,
    "B-250": 2,
    "A-500": 1,
  });
});
test("upsell suggests a bigger bag only when it costs less per 100 g", () => {
  assert.equal(largerPackage(book, book["a-250"])?.item.id, "a-500");
  assert.equal(largerPackage(book, book["a-500"]), null);
  assert.deepEqual(
    crossSell(book, ["cafe-a"]).map((suggestion) => suggestion.item.id),
    ["kit-teste", "b-250"],
  );
});

// ---------- money rules -------------------------------------------------
test("Pix discount is 5% of the coffees only; card has no discount; freight rules stay off", () => {
  assert.equal(pixDiscountCents(10000, rules), 500);
  assert.equal(pixDiscountCents(3990, rules), 200);
  assert.deepEqual(
    orderTotals({
      subtotalCents: 10000,
      shippingCents: 2500,
      method: "pix",
      rules,
    }),
    { discountCents: 500, totalCents: 12000 },
  );
  assert.deepEqual(
    orderTotals({
      subtotalCents: 10000,
      shippingCents: 2500,
      method: "card",
      rules,
    }),
    { discountCents: 0, totalCents: 12500 },
  );
  // The customer pays all freight while no rule is approved.
  assert.equal(chargedShippingCents(2500, 99999, rules), 2500);
  assert.equal(
    chargedShippingCents(2500, 10000, {
      freeShippingFromCents: null,
      shippingSubsidyCents: 1000,
    }),
    1500,
  );
  assert.equal(
    chargedShippingCents(2500, 10000, {
      freeShippingFromCents: 10000,
      shippingSubsidyCents: null,
    }),
    0,
  );
});

// ---------- packing and freight -----------------------------------------
test("packing groups bags into the smallest box and splits by weight, never one naive parcel", () => {
  const cart = (items: { id: string; quantity: number }[]) =>
    priceCart(items, book, rules).lines;
  const two = packCart(cart([{ id: "a-250", quantity: 2 }]), rules);
  assert.equal(two.length, 1);
  assert.equal(two[0].box.id, "caixa-p");
  assert.equal(two[0].weightGrams, 2 * 300 + 150);
  assert.deepEqual(two[0].items, [{ sku: "A-250", quantity: 2 }]);
  // ~4.8 kg of coffee bags: more than one 4 kg volume, each within limits.
  const heavy = packCart(cart([{ id: "a-1000", quantity: 4 }]), rules);
  assert.ok(heavy.length >= 2);
  for (const volume of heavy) assert.ok(volume.weightGrams <= 4000);
  assert.equal(
    heavy.reduce((n, v) => n + v.items.reduce((m, i) => m + i.quantity, 0), 0),
    4,
  );
  assert.equal(
    heavy.reduce((n, v) => n + v.insuranceCents, 0),
    4 * book["a-1000"].unitPriceCents,
  );
  // A kit ships as its bags.
  const kit = packCart(cart([{ id: "kit-teste", quantity: 1 }]), rules);
  assert.deepEqual(kit[0].items, [
    { sku: "A-250", quantity: 1 },
    { sku: "B-250", quantity: 1 },
  ]);
  assert.throws(
    () => packCart(cart(lines), { ...rules, boxes: [] }),
    (error) => error instanceof PackingError && error.code === "no_boxes",
  );
  assert.throws(
    () =>
      packCart(cart([{ id: "a-1000", quantity: 1 }]), {
        ...rules,
        boxes: [TEST_BOXES[0]],
      }),
    (error) => error instanceof PackingError && error.code === "unit_too_large",
  );
});
test("per-volume quotes: a service must serve every volume; prices add up, slowest time wins", () => {
  const combined = combineQuotes([
    [
      {
        id: 1,
        name: "PAC",
        price: "20.00",
        delivery_time: 7,
        company: { name: "Correios" },
      },
      {
        id: 3,
        name: ".Package",
        price: "18.50",
        delivery_time: 5,
        company: { name: "Jadlog" },
      },
    ],
    [
      {
        id: 1,
        name: "PAC",
        price: "22.00",
        delivery_time: 8,
        company: { name: "Correios" },
      },
      {
        id: 3,
        name: ".Package",
        error: "Transportadora não atende este trecho.",
      },
    ],
  ]);
  assert.deepEqual(combined, [
    {
      id: "1",
      name: "PAC",
      company: "Correios",
      priceCents: 4200,
      days: 8,
      volumes: 2,
    },
  ]);
  assert.deepEqual(combineQuotes([[{ id: 2, name: "SEDEX", error: "x" }]]), []);
});
test("freight is quoted per destination (SP, RJ, Northeast) with PAC and .Package from the quote", async () => {
  const sp = await quoteShipping(deps, { cep: "01310-100", lines });
  const rj = await quoteShipping(deps, { cep: "20040-020", lines });
  const ne = await quoteShipping(deps, { cep: "50030-230", lines });
  for (const quote of [sp, rj, ne]) {
    assert.deepEqual(quote.options.map((o) => o.name).sort(), [
      ".Package",
      "PAC",
    ]);
    assert.equal(quote.volumes.length, 1);
    assert.equal(quote.pixDiscountCents, 500);
  }
  assert.ok(sp.options[0].priceCents < rj.options[0].priceCents);
  assert.ok(rj.options[0].priceCents < ne.options[0].priceCents);
  assert.deepEqual(shipping.calls[0].services, ["1", "3"]);
  // ~4 kg cart: several volumes, each sent to the quote.
  const heavy = await quoteShipping(deps, {
    cep: "01310-100",
    lines: [{ id: "a-1000", quantity: 4 }],
  });
  assert.ok(heavy.volumes.length >= 2);
  assert.equal(heavy.options[0].volumes, heavy.volumes.length);
  assert.equal(shipping.calls.at(-1)!.volumes.length, heavy.volumes.length);
  // A cart change gives a different quote.
  const more = await quoteShipping(deps, {
    cep: "01310-100",
    lines: [{ id: "a-250", quantity: 6 }],
  });
  assert.notEqual(more.options[0].priceCents, sp.options[0].priceCents);
});
test("freight failures are explicit: provider down, no service, no boxes, invalid CEP", async () => {
  shipping.setDown(true);
  await rejects(
    quoteShipping(deps, { cep: "01310-100", lines }),
    "shipping_unavailable",
  );
  shipping.setDown(false);
  await rejects(quoteShipping(deps, { cep: "123", lines }), "invalid_input");
  await rejects(
    quoteShipping(deps, { cep: "01310100", lines: [] }),
    "empty_cart",
  );
  await rejects(
    quoteShipping(
      { ...deps, rules: { ...rules, boxes: [] } },
      { cep: "01310100", lines },
    ),
    "shipping_unavailable",
  );
  const none = fakeShipping({ services: [] });
  await rejects(
    quoteShipping(
      { ...deps, shipping: none.gateway },
      { cep: "01310100", lines },
    ),
    "shipping_unavailable",
  );
});

// ---------- checkout ----------------------------------------------------
test("Pix checkout: one order, stock reserved, 5% off the coffees, QR Code and deadline", async () => {
  const body = await checkout();
  const view = await createCheckout(deps, body);
  assert.equal(view!.status, "pending_payment");
  assert.equal(view!.subtotalCents, 10000);
  assert.equal(view!.discountCents, 500);
  assert.equal(view!.shippingCents, body.shippingPriceCents);
  assert.equal(view!.totalCents, 10000 - 500 + Number(body.shippingPriceCents));
  assert.ok(view!.payment!.pix!.qrCode.startsWith("00020126"));
  assert.ok(view!.payment!.pix!.qrCodeBase64);
  assert.equal(view!.payment!.invoiceUrl, null);
  assert.equal(
    new Date(view!.expiresAt!).getTime(),
    clock.getTime() + 30 * 60_000,
  );
  assert.equal(await stock("A-250"), 3);
  assert.equal(payments.created.length, 1);
  assert.equal(payments.created[0].amountCents, view!.totalCents);
  assert.equal(payments.created[0].method, "pix");
  assert.equal(payments.created[0].customer.cpf, VALID_CPF);
  assert.ok(canReadOrder(deps, view!.id, view!.token!));
  assert.ok(!canReadOrder(deps, view!.id, "x"));
  assert.deepEqual(
    mail.sent.map((m) => m.kind),
    ["order_received"],
  );
  // The buyer view never exposes personal data.
  const text = JSON.stringify(await orderView(deps, view!.id));
  assert.ok(!text.includes(VALID_CPF) && !/example\.com/i.test(text));
});
test("card checkout: no discount, pays on the Asaas page, and card data is never accepted", async () => {
  const view = await createCheckout(
    deps,
    await checkout({ payment: { method: "card" } }),
  );
  assert.equal(view!.discountCents, 0);
  assert.equal(view!.totalCents, 10000 + view!.shippingCents);
  assert.match(view!.payment!.invoiceUrl!, /^https:\/\/asaas\.test\//);
  assert.equal(view!.payment!.pix, null);
  assert.equal(
    payments.created[0].successUrl.startsWith("https://loja.test/pedido/"),
    true,
  );
  assert.equal(
    new Date(view!.expiresAt!).getTime(),
    clock.getTime() + 60 * 60_000,
  );
  for (const payment of [
    { method: "card", token: "tok", number: "4111111111111111" },
    { method: "boleto" },
  ])
    await rejects(
      createCheckout(deps, await checkout({ payment })),
      "invalid_input",
    );
});
test("prices, discount and freight come from the server; a changed quote must be confirmed", async () => {
  const view = await createCheckout(
    deps,
    await checkout({
      lines: [{ id: "a-250", quantity: 1 }],
    }),
  );
  assert.equal(view!.subtotalCents, 5000);
  // The browser cannot send prices.
  await rejects(
    createCheckout(deps, {
      ...(await checkout()),
      lines: [{ id: "a-250", quantity: 1, unitPriceCents: 1 }],
    }),
    "invalid_input",
  );
  // Expired or stale quote: the freight now differs from what was shown.
  await rejects(
    createCheckout(deps, await checkout({ shippingPriceCents: 1 })),
    "shipping_changed",
  );
  await rejects(
    createCheckout(deps, await checkout({ shippingOptionId: "2" })),
    "shipping_changed",
  );
  await rejects(
    createCheckout(
      deps,
      await checkout({ lines: [{ id: "b-sem-preco", quantity: 1 }] }),
    ),
    "item_unavailable",
  );
});
test("invalid customer data is refused before anything is created", async () => {
  assert.ok(isValidCpf(VALID_CPF));
  assert.ok(!isValidCpf("11111111111"));
  const base = await checkout();
  const customer = base.customer as Record<string, string>;
  for (const bad of [
    { ...base, consent: false },
    { ...base, customer: { ...customer, cpf: "123.456.789-00" } },
    { ...base, address: { ...address, state: "XX" } },
    { ...base, customer: { ...customer, name: "Maria" } },
  ])
    await rejects(createCheckout(deps, bad), "invalid_input");
  assert.equal((await db.query("SELECT 1 FROM orders")).length, 0);
});
test("idempotency: a repeated or simultaneous submission is one order and one charge", async () => {
  const body = await checkout();
  const [first, second] = await Promise.all([
    createCheckout(deps, body),
    createCheckout(deps, body),
  ]);
  const third = await createCheckout(deps, body);
  assert.equal(first!.id, second!.id);
  assert.equal(first!.id, third!.id);
  assert.equal((await db.query("SELECT 1 FROM orders")).length, 1);
  assert.equal(payments.created.length, 1);
  assert.equal(await stock("A-250"), 3);
  await rejects(
    createCheckout(deps, { ...body, payment: { method: "card" } }),
    "idempotency_conflict",
  );
});
test("concurrent buyers never oversell: stock is reserved atomically", async () => {
  const bodies = await Promise.all(
    Array.from({ length: 5 }, () =>
      checkout({ lines: [{ id: "b-250", quantity: 1 }] }),
    ),
  );
  const results = await Promise.allSettled(
    bodies.map((body) => createCheckout(deps, body)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.ok(
    results
      .filter((r) => r.status === "rejected")
      .every(
        (r) =>
          (r as PromiseRejectedResult).reason instanceof CheckoutError &&
          (r as PromiseRejectedResult).reason.code === "insufficient_stock",
      ),
  );
  assert.equal(await stock("B-250"), 0);
  assert.equal((await db.query("SELECT 1 FROM orders")).length, 2);
});
test("a paused SKU or missing stock refuses the order and leaves stock untouched", async () => {
  await db.query("UPDATE inventory SET paused = true WHERE sku = 'A-250'");
  await rejects(createCheckout(deps, await checkout()), "insufficient_stock");
  assert.equal(await stock("A-250"), 5);
  assert.deepEqual(await availability(deps, ["a-250", "a-500", "kit-teste"]), {
    "a-250": 0,
    "a-500": 5,
    "kit-teste": 0,
  });
});
test("a failure creating the charge keeps the order; the retry creates it once", async () => {
  payments.failNext();
  const body = await checkout();
  await rejects(createCheckout(deps, body), "payment_unavailable");
  const [order] = await db.query<{ id: string }>("SELECT id FROM orders");
  assert.equal(await stock("A-250"), 3);
  const retry = await createCheckout(deps, body);
  assert.equal(retry!.id, order.id);
  assert.ok(retry!.payment?.pix);
  assert.equal(payments.created.length, 1);
});

// ---------- webhooks ----------------------------------------------------
test("confirmed payment: paid once; duplicate, replayed and out-of-order events change nothing", async () => {
  const view = await createCheckout(deps, await checkout());
  const payment = paymentOf(view!.id);
  // Only Asaas marks paid: the buyer page alone stays pending.
  assert.equal((await orderView(deps, view!.id))!.status, "pending_payment");
  payments.set(payment.id, { status: "RECEIVED" });
  const eventId = "evt_1";
  assert.deepEqual(await webhook("PAYMENT_RECEIVED", payment.id, eventId), {
    processed: true,
    outcome: "paid",
  });
  assert.deepEqual(await webhook("PAYMENT_RECEIVED", payment.id, eventId), {
    processed: false,
    reason: "duplicate",
  });
  // Late events of an older state (Asaas re-read says RECEIVED) and a
  // CONFIRMED after RECEIVED: no second transition, no stock change.
  for (const event of [
    "PAYMENT_CREATED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_UPDATED",
  ])
    assert.deepEqual(await webhook(event, payment.id), {
      processed: true,
      outcome: null,
    });
  assert.equal(await stock("A-250"), 3);
  assert.equal((await row(view!.id)).status, "paid");
  assert.deepEqual(
    mail.sent.map((m) => m.kind),
    ["order_received", "payment_confirmed"],
  );
  // The webhook body is never trusted: if Asaas says PENDING, it is pending.
  const other = await createCheckout(deps, await checkout());
  await webhook("PAYMENT_RECEIVED", paymentOf(other!.id).id);
  assert.equal((await row(other!.id)).status, "pending_payment");
});
test("a refund reaches only a paid order; a paid order never expires or goes back", async () => {
  const view = await createCheckout(deps, await checkout());
  const payment = paymentOf(view!.id);
  payments.set(payment.id, { status: "OVERDUE" });
  payments.set(payment.id, { status: "CONFIRMED" });
  await webhook("PAYMENT_CONFIRMED", payment.id);
  for (const status of ["OVERDUE", "DELETED", "PENDING"]) {
    payments.set(payment.id, { status });
    assert.deepEqual(await webhook("PAYMENT_UPDATED", payment.id), {
      processed: true,
      outcome: null,
    });
  }
  assert.equal(await stock("A-250"), 3);
  payments.set(payment.id, { status: "REFUNDED" });
  assert.deepEqual(await webhook("PAYMENT_REFUNDED", payment.id), {
    processed: true,
    outcome: "refunded",
  });
  payments.set(payment.id, { status: "RECEIVED" });
  assert.deepEqual(await webhook("PAYMENT_RECEIVED", payment.id), {
    processed: true,
    outcome: null,
  });
  assert.equal((await row(view!.id)).status, "refunded");
});
test("a payment with a different amount is not accepted as paid", async () => {
  const view = await createCheckout(deps, await checkout());
  const payment = paymentOf(view!.id);
  payments.set(payment.id, { status: "RECEIVED", amountCents: 1 });
  await webhook("PAYMENT_RECEIVED", payment.id);
  assert.equal((await row(view!.id)).status, "pending_payment");
  const events = await db.query<{ type: string }>(
    "SELECT type FROM order_events WHERE order_id = $1",
    [view!.id],
  );
  assert.ok(events.some((e) => e.type === "payment.amount_mismatch"));
});
test("provider failures are retried; unknown charges and other events are ignored", async () => {
  const view = await createCheckout(deps, await checkout());
  const payment = paymentOf(view!.id);
  payments.set(payment.id, { status: "RECEIVED" });
  const original = deps.payments.get;
  deps.payments.get = async () => {
    throw new Error("Asaas fora do ar");
  };
  await assert.rejects(webhook("PAYMENT_RECEIVED", payment.id, "evt_r"));
  deps.payments.get = original;
  assert.equal((await db.query("SELECT 1 FROM webhook_events")).length, 0);
  assert.deepEqual(await webhook("PAYMENT_RECEIVED", payment.id, "evt_r"), {
    processed: true,
    outcome: "paid",
  });
  assert.deepEqual(await webhook("PAYMENT_RECEIVED", "pay_desconhecido"), {
    processed: false,
    reason: "unknown_order",
  });
  assert.deepEqual(
    await handleAsaasWebhook(deps, {
      eventId: "evt_x",
      event: "TRANSFER_DONE",
      paymentId: null,
    }),
    { processed: false, reason: "ignored_event" },
  );
});

// ---------- expiry and reconciliation ------------------------------------
test("an unpaid order expires: the charge is removed at Asaas and stock returns exactly once", async () => {
  const view = await createCheckout(deps, await checkout());
  const payment = paymentOf(view!.id);
  assert.deepEqual(await expireOverdue(deps), {});
  clock = new Date(clock.getTime() + 31 * 60_000);
  assert.deepEqual(await expireOverdue(deps), { [view!.id]: "expired" });
  assert.deepEqual(payments.cancelled, [payment.id]);
  assert.equal((await row(view!.id)).status, "expired");
  assert.equal(await stock("A-250"), 5);
  assert.deepEqual(await expireOverdue(deps), {});
  // Asaas confirms the removal later: nothing changes.
  assert.deepEqual(await webhook("PAYMENT_DELETED", payment.id), {
    processed: true,
    outcome: null,
  });
  assert.equal(await stock("A-250"), 5);
  assert.ok(mail.sent.some((m) => m.kind === "order_expired"));
});
test("paid right at the deadline: the payment wins over the expiry", async () => {
  const view = await createCheckout(deps, await checkout());
  payments.set(paymentOf(view!.id).id, { status: "RECEIVED" });
  clock = new Date(clock.getTime() + 31 * 60_000);
  assert.deepEqual(await expireOverdue(deps), { [view!.id]: "paid" });
  assert.equal(await stock("A-250"), 3);
  assert.deepEqual(payments.cancelled, []);
});
test("paid after expiry: stock is taken again, or the order is flagged when it is gone", async () => {
  const first = await createCheckout(deps, await checkout());
  clock = new Date(clock.getTime() + 31 * 60_000);
  await expireOverdue(deps);
  assert.equal(await stock("A-250"), 5);
  // Asaas still confirms (e.g. Pix settled while the removal was in flight).
  payments.set(paymentOf(first!.id).id, { status: "RECEIVED" });
  await webhook("PAYMENT_RECEIVED", paymentOf(first!.id).id);
  assert.equal((await row(first!.id)).status, "paid");
  assert.equal(await stock("A-250"), 3);
  // Same, with no stock left: still paid (money received), flagged.
  const second = await createCheckout(
    deps,
    await checkout({ lines: [{ id: "b-250", quantity: 2 }] }),
  );
  clock = new Date(clock.getTime() + 31 * 60_000);
  await expireOverdue(deps);
  await db.query("UPDATE inventory SET available = 0 WHERE sku = 'B-250'");
  payments.set(paymentOf(second!.id).id, { status: "RECEIVED" });
  await webhook("PAYMENT_RECEIVED", paymentOf(second!.id).id);
  const order = await row(second!.id);
  assert.equal(order.status, "paid");
  assert.equal(order.stock_released, true);
  const events = await db.query<{ type: string }>(
    "SELECT type FROM order_events WHERE order_id = $1",
    [second!.id],
  );
  assert.ok(events.some((e) => e.type === "payment.paid_without_stock"));
});
test("expired holds are freed when a new buyer needs the stock", async () => {
  await createCheckout(
    deps,
    await checkout({ lines: [{ id: "b-250", quantity: 2 }] }),
  );
  assert.equal(await stock("B-250"), 0);
  clock = new Date(clock.getTime() + 31 * 60_000);
  const next = await createCheckout(
    deps,
    await checkout({ lines: [{ id: "b-250", quantity: 1 }] }),
  );
  assert.equal(next!.status, "pending_payment");
  assert.equal(await stock("B-250"), 1);
});
test("reconciliation re-reads pending charges (a lost webhook) and expires overdue orders", async () => {
  const view = await createCheckout(deps, await checkout());
  await db.query(
    "UPDATE payments SET created_at = now() - interval '5 minutes'",
  );
  payments.set(paymentOf(view!.id).id, { status: "RECEIVED" });
  const result = await reconcile(deps);
  assert.deepEqual(result.synced, { [view!.id]: "paid" });
  assert.equal((await row(view!.id)).status, "paid");
});

test("published prices match the team's pricing sheet (card price; Pix 5% less)", async () => {
  const { loadContent } = await import("../../lib/content-loader");
  const offers = loadContent().offers;
  const price = (id: string) =>
    offers.find((offer) => offer.id === id)!.unitPriceInCents!;
  // Planilha de precificação de 12/11/2026 (Preço no cartão / Preço no Pix).
  const sheet: [string, number, number][] = [
    ["samba-250g-graos", 2849, 2707],
    ["salsa-250g-graos", 2849, 2707],
    ["da-casa-250g-graos", 2652, 2519],
    ["samba-500g-graos", 4911, 4665],
    ["samba-1kg-graos", 9033, 8581],
    ["da-casa-500g-graos", 4516, 4290],
    ["da-casa-1kg-graos", 8244, 7832],
  ];
  const real = commerceRulesSchema.parse(
    (await import("../../content/commerce.json")).default,
  );
  for (const [id, card, pix] of sheet) {
    assert.equal(price(id), card, id);
    assert.equal(card - pixDiscountCents(card, real), pix, id);
  }
  // 500 g and 1 kg keep their price but stay drafts until the team publishes.
  for (const id of ["samba-500g-graos", "da-casa-1kg-graos"])
    assert.equal(offers.find((offer) => offer.id === id)!.status, "draft");
});
