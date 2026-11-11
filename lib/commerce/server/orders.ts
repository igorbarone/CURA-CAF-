import { randomUUID } from "node:crypto";
import { z } from "zod";
import { normalizeCart, priceCart, skuDemand, type PricedLine } from "../cart";
import { brasiliaDate, onSale, type PriceBook } from "../catalog";
import { packCart, PackingError, type Volume } from "../packing";
import {
  chargedShippingCents,
  orderTotals,
  pixDiscountCents,
} from "../pricing";
import type { CommerceRules } from "../rules";
import {
  financialStatus,
  GatewayError,
  type PaymentGateway,
  type ProviderPayment,
} from "./asaas";
import type { Db, Queryable } from "./db";
import { log } from "./log";
import type { Notifier, OrderMessage } from "./notify";
import { isValidCpf, orderToken, safeEqual, sha256 } from "./security";
import { normalizeCep, ShippingError, type ShippingGateway } from "./shipping";

export type Deps = {
  db: Db;
  payments: PaymentGateway;
  shipping: ShippingGateway;
  notifier: Notifier;
  book: PriceBook;
  rules: CommerceRules;
  siteUrl: string;
  tokenSecret: string;
  now?: () => Date;
};
export class CheckoutError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "empty_cart"
      | "item_unavailable"
      | "insufficient_stock"
      | "shipping_unavailable"
      | "shipping_changed"
      | "idempotency_conflict"
      | "payment_unavailable"
      | "invalid_transition"
      | "not_found",
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
const UF =
  /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;
const field = (max: number) => z.string().trim().min(1).max(max);
// No card data is ever accepted here: card is paid on the Asaas page.
export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            id: z.string().max(80),
            quantity: z.number().int().min(1).max(50),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    customer: z
      .object({
        name: field(120).refine((value) => value.split(/\s+/).length >= 2, {
          message: "Informe nome e sobrenome",
        }),
        email: z.string().trim().toLowerCase().email().max(160),
        cpf: z
          .string()
          .transform((value) => value.replace(/\D/g, ""))
          .refine(isValidCpf, { message: "CPF inválido" }),
        phone: z
          .string()
          .transform((value) => value.replace(/\D/g, ""))
          .refine((value) => /^\d{10,11}$/.test(value), {
            message: "Telefone com DDD",
          }),
      })
      .strict(),
    address: z
      .object({
        cep: z
          .string()
          .transform(normalizeCep)
          .refine((value) => /^\d{8}$/.test(value), {
            message: "CEP inválido",
          }),
        street: field(160),
        number: field(20),
        complement: z.string().trim().max(80).default(""),
        district: field(80),
        city: field(80),
        state: z.string().trim().toUpperCase().regex(UF),
      })
      .strict(),
    shippingOptionId: z.string().max(40),
    // Freight the buyer saw: if the new server quote differs, the buyer
    // confirms again instead of paying a price they did not see.
    shippingPriceCents: z.number().int().nonnegative(),
    consent: z.literal(true),
    payment: z.object({ method: z.enum(["pix", "card"]) }).strict(),
  })
  .strict();
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "payment_failed"
  | "cancelled"
  | "expired"
  | "refunded";
export type FulfillmentStatus =
  "unfulfilled" | "preparing" | "shipped" | "delivered";
export type OrderItem = {
  id: string;
  name: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  listPriceCents: number;
  lineTotalCents: number;
  skus: { sku: string; quantity: number }[];
};
export type OrderRow = {
  id: string;
  status: OrderStatus;
  fulfillment_status: FulfillmentStatus;
  idempotency_key: string;
  request_hash: string;
  customer: { name: string; email: string; cpf: string; phone: string };
  address: CheckoutInput["address"];
  items: OrderItem[];
  shipping: {
    id: string;
    name: string;
    company: string;
    priceCents: number;
    quotedCents: number;
    days: number | null;
    volumes: number;
  };
  volumes: Volume[];
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  payment_method: "pix" | "card";
  payment_provider: string;
  stock_released: boolean;
  tracking_code: string | null;
  tracking_carrier: string | null;
  expires_at: string | Date | null;
  paid_at: string | Date | null;
  shipped_at: string | Date | null;
  delivered_at: string | Date | null;
  created_at: string | Date;
};
type PaymentRow = {
  provider_payment_id: string;
  status: string;
  method: string;
  amount_cents: number;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  invoice_url: string | null;
};
const nowOf = (deps: Pick<Deps, "now">) => deps.now?.() ?? new Date();

// Freight for a cart: packed into volumes, each volume quoted, only services
// that quote every volume offered. The buyer pays the quoted freight unless
// an approved subsidy or free-shipping rule applies.
export async function quoteShipping(
  deps: Pick<Deps, "shipping" | "book" | "rules" | "now">,
  input: { cep: string; lines: unknown },
) {
  const cep = normalizeCep(input.cep);
  if (!/^\d{8}$/.test(cep))
    throw new CheckoutError("invalid_input", 400, { field: "cep" });
  const cart = priceCart(
    normalizeCart(input.lines, deps.book, deps.rules, nowOf(deps)).lines,
    deps.book,
    deps.rules,
  );
  if (!cart.lines.length) throw new CheckoutError("empty_cart", 400);
  let volumes: Volume[];
  try {
    volumes = packCart(cart.lines, deps.rules);
  } catch (error) {
    if (error instanceof PackingError)
      throw new CheckoutError("shipping_unavailable", 422, {
        reason: error.code,
      });
    throw error;
  }
  let options;
  try {
    options = await deps.shipping.quote({
      toCep: cep,
      volumes,
      services: deps.rules.shippingServiceIds,
    });
  } catch (error) {
    if (error instanceof ShippingError)
      throw new CheckoutError("shipping_unavailable", 503);
    throw error;
  }
  if (!options.length)
    throw new CheckoutError("shipping_unavailable", 422, {
      reason: "no_service",
    });
  return {
    subtotalCents: cart.subtotalCents,
    pixDiscountCents: pixDiscountCents(cart.subtotalCents, deps.rules),
    freeShipping: cart.freeShipping,
    volumes,
    options: options.map((option) => ({
      ...option,
      chargedCents: chargedShippingCents(
        option.priceCents,
        cart.subtotalCents,
        deps.rules,
      ),
    })),
  };
}

// Takes stock for every SKU or for none: rows are locked and checked first,
// then decremented. Returns the SKUs that are short (empty = reserved).
async function tryReserve(
  tx: Queryable,
  demand: Map<string, number>,
  { respectPause }: { respectPause: boolean },
) {
  const skus = [...demand.keys()].sort();
  const rows = await tx.query<{
    sku: string;
    available: number;
    paused: boolean;
  }>(
    "SELECT sku, available, paused FROM inventory WHERE sku = ANY($1) ORDER BY sku FOR UPDATE",
    [skus],
  );
  const stock = new Map(rows.map((row) => [row.sku, row]));
  const short = skus.filter((sku) => {
    const row = stock.get(sku);
    return (
      !row ||
      row.available < (demand.get(sku) ?? 0) ||
      (respectPause && row.paused)
    );
  });
  if (short.length) return short;
  for (const sku of skus)
    await tx.query(
      "UPDATE inventory SET available = available - $2, updated_at = now() WHERE sku = $1",
      [sku, demand.get(sku)],
    );
  return [];
}
function demandOf(items: OrderItem[]) {
  const demand = new Map<string, number>();
  for (const item of items)
    for (const sku of item.skus)
      demand.set(
        sku.sku,
        (demand.get(sku.sku) ?? 0) + sku.quantity * item.quantity,
      );
  return demand;
}
// Gives the reserved stock back, exactly once per order.
async function release(tx: Queryable, order: OrderRow) {
  if (order.stock_released) return;
  for (const [sku, quantity] of demandOf(order.items))
    await tx.query(
      "UPDATE inventory SET available = available + $2, updated_at = now() WHERE sku = $1",
      [sku, quantity],
    );
  await tx.query("UPDATE orders SET stock_released = true WHERE id = $1", [
    order.id,
  ]);
}
export const event = (
  tx: Queryable,
  orderId: string,
  type: string,
  data: object = {},
) =>
  tx.query(
    "INSERT INTO order_events (order_id, type, data) VALUES ($1, $2, $3)",
    [orderId, type, JSON.stringify(data)],
  );
const lockOrder = async (tx: Queryable, id: string) =>
  (
    await tx.query<OrderRow>("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [
      id,
    ])
  )[0];

export async function createCheckout(deps: Deps, raw: unknown) {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success)
    throw new CheckoutError("invalid_input", 400, {
      fields: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
  const input = parsed.data;
  const requestHash = sha256(
    JSON.stringify({
      lines: input.lines,
      customer: input.customer,
      address: input.address,
      shippingOptionId: input.shippingOptionId,
      shippingPriceCents: input.shippingPriceCents,
      method: input.payment.method,
    }),
  );
  const existing = (
    await deps.db.query<OrderRow>(
      "SELECT * FROM orders WHERE idempotency_key = $1",
      [input.idempotencyKey],
    )
  )[0];
  if (existing) {
    if (!safeEqual(existing.request_hash, requestHash))
      throw new CheckoutError("idempotency_conflict", 409);
    return ensurePayment(deps, existing);
  }
  const normalized = normalizeCart(
    input.lines,
    deps.book,
    deps.rules,
    nowOf(deps),
  );
  if (normalized.removed.length)
    throw new CheckoutError("item_unavailable", 409, {
      ids: normalized.removed,
    });
  const cart = priceCart(normalized.lines, deps.book, deps.rules);
  if (!cart.lines.length) throw new CheckoutError("empty_cart", 400);
  // The freight is quoted again here; the browser's number only proves what
  // the buyer saw.
  const quote = await quoteShipping(deps, {
    cep: input.address.cep,
    lines: normalized.lines,
  });
  const option = quote.options.find(
    (item) => item.id === input.shippingOptionId,
  );
  if (!option || option.chargedCents !== input.shippingPriceCents)
    throw new CheckoutError("shipping_changed", 409, {
      options: quote.options,
    });
  const { discountCents, totalCents } = orderTotals({
    subtotalCents: cart.subtotalCents,
    shippingCents: option.chargedCents,
    method: input.payment.method,
    rules: deps.rules,
  });
  const now = nowOf(deps);
  const minutes =
    input.payment.method === "pix"
      ? deps.rules.pixExpirationMinutes
      : deps.rules.cardExpirationMinutes;
  const order = {
    id: randomUUID(),
    items: cart.lines.map((line): OrderItem => ({
      id: line.id,
      name: line.item.name,
      label: line.item.label,
      quantity: line.quantity,
      unitPriceCents: line.item.unitPriceCents,
      listPriceCents: line.item.listPriceCents,
      lineTotalCents: line.lineTotalCents,
      skus: line.item.skus,
    })),
    shipping: {
      id: option.id,
      name: option.name,
      company: option.company,
      priceCents: option.chargedCents,
      quotedCents: option.priceCents,
      days: option.days,
      volumes: option.volumes,
    },
    expiresAt: new Date(now.getTime() + minutes * 60_000),
  };
  const insert = () =>
    deps.db.transaction(async (tx) => {
      const inserted = await tx.query<OrderRow>(
        `INSERT INTO orders (id, idempotency_key, request_hash, status, customer, address, items, shipping,
           volumes, subtotal_cents, discount_cents, shipping_cents, total_cents, payment_method,
           payment_provider, expires_at)
         VALUES ($1, $2, $3, 'pending_payment', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'asaas', $14)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
        [
          order.id,
          input.idempotencyKey,
          requestHash,
          JSON.stringify(input.customer),
          JSON.stringify(input.address),
          JSON.stringify(order.items),
          JSON.stringify(order.shipping),
          JSON.stringify(quote.volumes),
          cart.subtotalCents,
          discountCents,
          option.chargedCents,
          totalCents,
          input.payment.method,
          order.expiresAt.toISOString(),
        ],
      );
      if (!inserted.length)
        throw new CheckoutError("idempotency_conflict", 409);
      const short = await tryReserve(tx, skuDemand(cart.lines), {
        respectPause: true,
      });
      if (short.length)
        throw new CheckoutError("insufficient_stock", 409, { skus: short });
      await event(tx, order.id, "order.created", {
        totalCents,
        discountCents,
        method: input.payment.method,
        volumes: quote.volumes.length,
      });
      return inserted[0];
    });
  let row: OrderRow;
  try {
    row = await insert();
  } catch (error) {
    // A concurrent duplicate submission: answer with the order that won.
    if (error instanceof CheckoutError && error.code === "idempotency_conflict")
      return createCheckout(deps, raw);
    // Stock held by orders whose payment deadline passed goes back first.
    if (
      error instanceof CheckoutError &&
      error.code === "insufficient_stock" &&
      Object.keys(await expireOverdue(deps)).length
    )
      row = await insert();
    else throw error;
  }
  log("order.created", {
    orderId: row.id,
    totalCents,
    method: input.payment.method,
  });
  return ensurePayment(deps, row);
}

// Creates the Asaas charge once per order. A short claim on the order keeps
// two simultaneous submissions from creating two charges; Asaas is also
// asked first for a charge with this order as externalReference.
async function ensurePayment(deps: Deps, order: OrderRow) {
  const current = await latestPayment(deps.db, order.id);
  if (current || order.status !== "pending_payment")
    return orderView(deps, order.id, { includeToken: true });
  const claimed = await deps.db.query(
    `UPDATE orders SET payment_claimed_at = now() WHERE id = $1 AND status = 'pending_payment'
       AND (payment_claimed_at IS NULL OR payment_claimed_at < now() - interval '30 seconds') RETURNING id`,
    [order.id],
  );
  if (!claimed.length) return orderView(deps, order.id, { includeToken: true });
  let payment: ProviderPayment;
  try {
    payment = await deps.payments.create({
      orderId: order.id,
      amountCents: order.total_cents,
      description: `Pedido Cura Café ${order.id.slice(0, 8).toUpperCase()}`,
      method: order.payment_method,
      dueDate: brasiliaDate(nowOf(deps)),
      customer: order.customer,
      successUrl: orderUrl(deps, order.id),
    });
  } catch (error) {
    await deps.db.query(
      "UPDATE orders SET payment_claimed_at = NULL WHERE id = $1",
      [order.id],
    );
    if (!(error instanceof GatewayError)) throw error;
    await event(deps.db, order.id, "payment.create_failed", {
      status: error.status,
    });
    log("payment.create_failed", { orderId: order.id, status: error.status });
    throw new CheckoutError("payment_unavailable", 502, { orderId: order.id });
  }
  await recordPayment(deps, order.id, payment);
  await notifyOrder(deps, order.id, "order_received");
  return orderView(deps, order.id, { includeToken: true });
}

async function latestPayment(db: Queryable, orderId: string) {
  return (
    await db.query<PaymentRow>(
      "SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1",
      [orderId],
    )
  )[0];
}

// Saves the provider's state and moves the order. Safe to call repeatedly
// and out of order: the state always comes from Asaas, transitions only move
// forward, and stock changes are guarded by the order's own flags.
// With `webhookId`, the delivery is marked as handled in the same
// transaction, so a failure anywhere leaves it free for the provider's retry.
async function recordPayment(
  deps: Deps,
  orderId: string,
  payment: ProviderPayment,
  webhook?: { id: string; event: string },
) {
  const outcome = await deps.db.transaction(async (tx) => {
    if (webhook) {
      const fresh = await tx.query(
        "INSERT INTO webhook_events (id, provider, resource_id) VALUES ($1, 'asaas', $2) ON CONFLICT (id) DO NOTHING RETURNING id",
        [webhook.id, payment.id],
      );
      if (!fresh.length) return "duplicate" as const;
    }
    await tx.query(
      `INSERT INTO payments (provider_payment_id, order_id, provider, method, status, amount_cents,
         pix_qr_code, pix_qr_code_base64, invoice_url)
       VALUES ($1, $2, 'asaas', $3, $4, $5, $6, $7, $8)
       ON CONFLICT (provider_payment_id) DO UPDATE SET status = EXCLUDED.status,
         pix_qr_code = COALESCE(EXCLUDED.pix_qr_code, payments.pix_qr_code),
         pix_qr_code_base64 = COALESCE(EXCLUDED.pix_qr_code_base64, payments.pix_qr_code_base64),
         invoice_url = COALESCE(EXCLUDED.invoice_url, payments.invoice_url),
         updated_at = now()`,
      [
        payment.id,
        orderId,
        payment.method,
        payment.status,
        payment.amountCents,
        payment.pix?.payload ?? null,
        payment.pix?.encodedImage ?? null,
        payment.invoiceUrl,
      ],
    );
    const order = await lockOrder(tx, orderId);
    if (webhook)
      await event(tx, orderId, "webhook.received", {
        event: webhook.event,
        paymentStatus: payment.status,
      });
    return transition(tx, order, payment);
  });
  if (outcome === "paid") await notifyOrder(deps, orderId, "payment_confirmed");
  if (outcome === "expired" || outcome === "cancelled")
    await notifyOrder(deps, orderId, "order_expired");
  return outcome;
}

async function transition(
  tx: Queryable,
  order: OrderRow,
  payment: ProviderPayment,
) {
  const target = financialStatus(payment.status);
  if (!target || order.status === target) return null;
  // Only a paid order can be refunded; a final state never goes back to
  // pending, and a replayed confirmation never changes a refunded order.
  if (target === "refunded" && order.status !== "paid") return null;
  if (order.status === "refunded") return null;
  if (
    (target === "expired" || target === "cancelled") &&
    order.status !== "pending_payment"
  )
    return null;
  if (target === "paid") {
    if (payment.amountCents !== order.total_cents) {
      await event(tx, order.id, "payment.amount_mismatch", {
        expected: order.total_cents,
        received: payment.amountCents,
      });
      log("payment.amount_mismatch", { orderId: order.id });
      return null;
    }
    if (order.stock_released) {
      // Paid after the order expired: take the stock again if it is there;
      // otherwise the panel flags the order for a refund or restock.
      const short = await tryReserve(tx, demandOf(order.items), {
        respectPause: false,
      });
      await tx.query("UPDATE orders SET stock_released = $2 WHERE id = $1", [
        order.id,
        short.length > 0,
      ]);
      await event(
        tx,
        order.id,
        short.length
          ? "payment.paid_without_stock"
          : "payment.paid_after_expiry",
        { from: order.status, skus: short },
      );
    }
  }
  if (target === "expired" || target === "cancelled") await release(tx, order);
  await tx.query(
    `UPDATE orders SET status = $2, updated_at = now(),
       paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE paid_at END WHERE id = $1`,
    [order.id, target],
  );
  await event(tx, order.id, `order.${target}`, {
    paymentStatus: payment.status,
  });
  log("order.transition", {
    orderId: order.id,
    from: order.status,
    to: target,
  });
  return target;
}

// Asaas webhook: the body only says which charge changed. Its state is read
// from Asaas itself before anything is recorded.
export async function handleAsaasWebhook(
  deps: Deps,
  input: { eventId: string; event: string; paymentId: string | null },
) {
  if (!input.event.startsWith("PAYMENT_") || !input.paymentId)
    return { processed: false, reason: "ignored_event" };
  const seen = await deps.db.query(
    "SELECT 1 FROM webhook_events WHERE id = $1",
    [input.eventId],
  );
  if (seen.length) return { processed: false, reason: "duplicate" };
  const payment = await deps.payments.get(input.paymentId);
  const known = (
    await deps.db.query<{ order_id: string }>(
      "SELECT order_id FROM payments WHERE provider_payment_id = $1",
      [input.paymentId],
    )
  )[0];
  const orderId =
    known?.order_id ??
    (
      await deps.db.query<{ id: string }>(
        "SELECT id FROM orders WHERE id::text = $1",
        [payment.externalReference ?? ""],
      )
    )[0]?.id;
  if (!orderId) {
    log("webhook.unknown_order", { paymentId: input.paymentId });
    return { processed: false, reason: "unknown_order" };
  }
  const outcome = await recordPayment(deps, orderId, payment, {
    id: input.eventId,
    event: input.event,
  });
  return outcome === "duplicate"
    ? { processed: false, reason: "duplicate" }
    : { processed: true, outcome };
}

// Expires one pending order past its deadline: the charge is removed at
// Asaas first (so it can no longer be paid); if Asaas says it was paid in
// the meantime, the payment wins.
export async function expireOrder(deps: Deps, orderId: string) {
  const payment = await latestPayment(deps.db, orderId);
  if (payment) {
    const fresh = await deps.payments.get(payment.provider_payment_id);
    if (financialStatus(fresh.status) === "paid")
      return recordPayment(deps, orderId, fresh);
    if (fresh.status !== "DELETED")
      try {
        await deps.payments.cancel(payment.provider_payment_id);
      } catch (error) {
        if (!(error instanceof GatewayError) || error.status !== 404)
          throw error;
      }
    // Paid between the read and the removal: the payment still wins.
    const after = await deps.payments.get(payment.provider_payment_id);
    if (financialStatus(after.status) === "paid")
      return recordPayment(deps, orderId, after);
  }
  const outcome = await deps.db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status !== "pending_payment") return null;
    await release(tx, order);
    await tx.query(
      "UPDATE orders SET status = 'expired', updated_at = now() WHERE id = $1",
      [orderId],
    );
    await event(tx, orderId, "order.expired", {
      reason: payment ? "deadline" : "no_payment",
    });
    return "expired" as const;
  });
  if (outcome) await notifyOrder(deps, orderId, "order_expired");
  return outcome;
}
export async function expireOverdue(deps: Deps, limit = 20) {
  const overdue = await deps.db.query<{ id: string }>(
    "SELECT id FROM orders WHERE status = 'pending_payment' AND expires_at < $1 ORDER BY expires_at LIMIT $2",
    [nowOf(deps).toISOString(), limit],
  );
  const results: Record<string, string | null> = {};
  for (const { id } of overdue) {
    try {
      results[id] = await expireOrder(deps, id);
    } catch (error) {
      log("order.expire_failed", {
        orderId: id,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return results;
}
// Scheduled safety net: re-reads pending charges (a webhook may have been
// lost) and expires overdue orders.
export async function reconcile(deps: Deps) {
  const pending = await deps.db.query<{
    order_id: string;
    provider_payment_id: string;
  }>(
    `SELECT p.order_id, p.provider_payment_id FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE o.status = 'pending_payment' AND p.created_at < now() - interval '2 minutes'
     ORDER BY p.created_at LIMIT 50`,
  );
  const synced: Record<string, string | null> = {};
  for (const row of pending)
    synced[row.order_id] = await recordPayment(
      deps,
      row.order_id,
      await deps.payments.get(row.provider_payment_id),
    );
  return { synced, expired: await expireOverdue(deps, 50) };
}

// Logistics status, separate from the financial one, moving forward only.
const NEXT_FULFILLMENT: Record<FulfillmentStatus, FulfillmentStatus | null> = {
  unfulfilled: "preparing",
  preparing: "shipped",
  shipped: "delivered",
  delivered: null,
};
export async function advanceFulfillment(
  deps: Deps,
  orderId: string,
  to: FulfillmentStatus,
  tracking: { code: string; carrier: string | null } | null = null,
) {
  const moved = await deps.db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new CheckoutError("not_found", 404);
    const allowed =
      order.status === "paid" &&
      (NEXT_FULFILLMENT[order.fulfillment_status] === to ||
        // Shipping straight from "paid" is fine (label or manual tracking).
        (to === "shipped" && order.fulfillment_status === "unfulfilled"));
    if (!allowed)
      throw new CheckoutError("invalid_transition", 409, {
        from: order.fulfillment_status,
        to,
        status: order.status,
      });
    if (to === "shipped" && !tracking?.code && !order.tracking_code)
      throw new CheckoutError("invalid_input", 400, { field: "tracking" });
    await tx.query(
      `UPDATE orders SET fulfillment_status = $2, updated_at = now(),
         tracking_code = COALESCE($3, tracking_code), tracking_carrier = COALESCE($4, tracking_carrier),
         shipped_at = CASE WHEN $2 = 'shipped' THEN now() ELSE shipped_at END,
         delivered_at = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END
       WHERE id = $1`,
      [orderId, to, tracking?.code ?? null, tracking?.carrier ?? null],
    );
    await event(tx, orderId, `fulfillment.${to}`, {
      carrier: tracking?.carrier ?? null,
    });
    return true;
  });
  if (moved && to === "shipped")
    await notifyOrder(deps, orderId, "order_shipped");
  return moved;
}

async function notifyOrder(
  deps: Deps,
  orderId: string,
  kind: OrderMessage["kind"],
) {
  const order = (
    await deps.db.query<OrderRow>("SELECT * FROM orders WHERE id = $1", [
      orderId,
    ])
  )[0];
  await deps.notifier.send({
    kind,
    to: order.customer.email,
    firstName: order.customer.name.split(/\s+/)[0],
    orderId,
    orderUrl: orderUrl(deps, orderId),
    totalCents: order.total_cents,
    tracking: order.tracking_code
      ? { code: order.tracking_code, carrier: order.tracking_carrier }
      : null,
  });
}
export const orderUrl = (
  deps: Pick<Deps, "siteUrl" | "tokenSecret">,
  orderId: string,
) =>
  `${deps.siteUrl}/pedido/?id=${orderId}&token=${orderToken(deps.tokenSecret, orderId)}`;

export function canReadOrder(
  deps: Pick<Deps, "tokenSecret">,
  orderId: string,
  token: string | null,
) {
  return !!token && safeEqual(orderToken(deps.tokenSecret, orderId), token);
}
// What the buyer sees: financial and logistics status in plain terms.
export function customerStatus(
  order: Pick<OrderRow, "status" | "fulfillment_status">,
) {
  if (order.status !== "paid") return order.status;
  return order.fulfillment_status === "unfulfilled"
    ? "paid"
    : order.fulfillment_status;
}

// What the buyer sees: no CPF, e-mail, phone or full address in the response.
export async function orderView(
  deps: Pick<Deps, "db" | "tokenSecret">,
  orderId: string,
  { includeToken = false } = {},
) {
  const order = (
    await deps.db.query<OrderRow>("SELECT * FROM orders WHERE id = $1", [
      orderId,
    ])
  )[0];
  if (!order) return null;
  const payment = await latestPayment(deps.db, orderId);
  const pending = order.status === "pending_payment";
  return {
    id: order.id,
    ...(includeToken ? { token: orderToken(deps.tokenSecret, order.id) } : {}),
    status: customerStatus(order),
    financialStatus: order.status,
    fulfillmentStatus: order.fulfillment_status,
    createdAt: new Date(order.created_at).toISOString(),
    expiresAt:
      pending && order.expires_at
        ? new Date(order.expires_at).toISOString()
        : null,
    firstName: order.customer.name.split(/\s+/)[0],
    destination: `${order.address.city} / ${order.address.state}`,
    items: order.items.map(
      ({ id, name, label, quantity, unitPriceCents, lineTotalCents }) => ({
        id,
        name,
        label,
        quantity,
        unitPriceCents,
        lineTotalCents,
      }),
    ),
    shipping: {
      name: order.shipping.name,
      company: order.shipping.company,
      days: order.shipping.days,
      volumes: order.shipping.volumes ?? order.volumes.length,
    },
    subtotalCents: order.subtotal_cents,
    discountCents: order.discount_cents,
    shippingCents: order.shipping_cents,
    totalCents: order.total_cents,
    paymentMethod: order.payment_method,
    payment: payment
      ? {
          status: payment.status,
          pix:
            pending && order.payment_method === "pix" && payment.pix_qr_code
              ? {
                  qrCode: payment.pix_qr_code,
                  qrCodeBase64: payment.pix_qr_code_base64,
                }
              : null,
          invoiceUrl:
            pending && order.payment_method === "card"
              ? payment.invoice_url
              : null,
        }
      : null,
    tracking: order.tracking_code
      ? { code: order.tracking_code, carrier: order.tracking_carrier }
      : null,
  };
}
export type OrderView = NonNullable<Awaited<ReturnType<typeof orderView>>>;

// Live availability per sellable item: units that can still be bought
// (kits need every SKU). Paused SKUs and closed sale windows count as zero.
export async function availability(
  deps: Pick<Deps, "db" | "book" | "now">,
  ids: string[],
) {
  const items = ids.map((id) => deps.book[id]).filter(Boolean);
  const skus = [
    ...new Set(items.flatMap((item) => item.skus.map((sku) => sku.sku))),
  ];
  const rows = skus.length
    ? await deps.db.query<{ sku: string; available: number; paused: boolean }>(
        "SELECT sku, available, paused FROM inventory WHERE sku = ANY($1)",
        [skus],
      )
    : [];
  const stock = new Map(
    rows.map((row) => [row.sku, row.paused ? 0 : row.available]),
  );
  const now = nowOf(deps);
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      onSale(item, now)
        ? Math.min(
            ...item.skus.map((sku) =>
              Math.floor((stock.get(sku.sku) ?? 0) / sku.quantity),
            ),
          )
        : 0,
    ]),
  );
}

// Homologation convenience: creates stock rows from the CMS "estoque
// editorial" for SKUs that have none yet. Existing rows are never touched, so
// the store's own stock (sales, ops) always wins.
export async function seedStockFromContent(
  db: Queryable,
  offers: { sku: string; availableQuantity: number | null }[],
) {
  const seeded: string[] = [];
  for (const offer of offers)
    if (offer.availableQuantity !== null) {
      const rows = await db.query(
        "INSERT INTO inventory (sku, available) VALUES ($1, $2) ON CONFLICT (sku) DO NOTHING RETURNING sku",
        [offer.sku, offer.availableQuantity],
      );
      if (rows.length) seeded.push(offer.sku);
    }
  return seeded;
}
export type { PricedLine };
