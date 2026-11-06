import { randomUUID } from "node:crypto";
import { z } from "zod";
import { normalizeCart, priceCart, skuDemand } from "../cart";
import type { PriceBook } from "../catalog";
import type { CommerceRules } from "../rules";
import type { Db, Queryable } from "./db";
import { log } from "./log";
import {
  GatewayError,
  type PaymentGateway,
  type ProviderPayment,
} from "./mercadopago";
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
      | "payment_unavailable",
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
const UF =
  /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;
const field = (max: number) => z.string().trim().min(1).max(max);
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
    consent: z.literal(true),
    payment: z.discriminatedUnion("method", [
      z.object({ method: z.literal("pix") }).strict(),
      z
        .object({
          method: z.literal("card"),
          token: z.string().min(8).max(200),
          paymentMethodId: z.string().min(2).max(40),
          installments: z.number().int().min(1).max(12),
          issuerId: z.string().max(40).nullish(),
        })
        .strict(),
    ]),
  })
  .strict();
export type CheckoutInput = z.infer<typeof checkoutSchema>;

type OrderRow = {
  id: string;
  status: string;
  idempotency_key: string;
  request_hash: string;
  customer: { name: string; email: string; cpf: string; phone: string };
  address: CheckoutInput["address"];
  items: {
    id: string;
    name: string;
    label: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    skus: { sku: string; quantity: number }[];
  }[];
  shipping: {
    id: string;
    name: string;
    company: string;
    priceCents: number;
    days: number | null;
  };
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  payment_method: "pix" | "card";
  stock_released: boolean;
  tracking_code: string | null;
  tracking_carrier: string | null;
  created_at: string | Date;
};
type PaymentRow = {
  provider_payment_id: string;
  status: string;
  status_detail: string | null;
  method: string;
  amount_cents: number;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  pix_ticket_url: string | null;
  expires_at: string | Date | null;
};

export async function quoteShipping(
  deps: Pick<Deps, "shipping" | "book" | "rules">,
  input: { cep: string; lines: unknown },
) {
  const cep = normalizeCep(input.cep);
  if (!/^\d{8}$/.test(cep))
    throw new CheckoutError("invalid_input", 400, { field: "cep" });
  const cart = priceCart(
    normalizeCart(input.lines, deps.book, deps.rules).lines,
    deps.book,
    deps.rules,
  );
  if (!cart.lines.length) throw new CheckoutError("empty_cart", 400);
  let options;
  try {
    options = await deps.shipping.quote({
      toCep: cep,
      weightGrams: cart.weightGrams,
      insuranceCents: cart.subtotalCents,
    });
  } catch (error) {
    if (error instanceof ShippingError)
      throw new CheckoutError("shipping_unavailable", 503);
    throw error;
  }
  if (!options.length) throw new CheckoutError("shipping_unavailable", 422);
  return {
    subtotalCents: cart.subtotalCents,
    freeShipping: cart.freeShipping,
    options: options.map((option) => ({
      ...option,
      chargedCents: cart.freeShipping ? 0 : option.priceCents,
    })),
  };
}

// Reserves stock atomically: every SKU must have enough units, or nothing is
// reserved (the transaction rolls back).
async function reserve(tx: Queryable, demand: Map<string, number>) {
  const short: string[] = [];
  for (const [sku, quantity] of [...demand].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const rows = await tx.query(
      "UPDATE inventory SET available = available - $2, updated_at = now() WHERE sku = $1 AND available >= $2 RETURNING sku",
      [sku, quantity],
    );
    if (!rows.length) short.push(sku);
  }
  if (short.length)
    throw new CheckoutError("insufficient_stock", 409, { skus: short });
}
async function release(tx: Queryable, order: OrderRow) {
  if (order.stock_released) return;
  for (const item of order.items)
    for (const sku of item.skus)
      await tx.query(
        "UPDATE inventory SET available = available + $2, updated_at = now() WHERE sku = $1",
        [sku.sku, sku.quantity * item.quantity],
      );
  await tx.query("UPDATE orders SET stock_released = true WHERE id = $1", [
    order.id,
  ]);
}
const event = (
  tx: Queryable,
  orderId: string,
  type: string,
  data: object = {},
) =>
  tx.query(
    "INSERT INTO order_events (order_id, type, data) VALUES ($1, $2, $3)",
    [orderId, type, JSON.stringify(data)],
  );

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
    return ensurePayment(deps, existing, input);
  }
  const normalized = normalizeCart(input.lines, deps.book, deps.rules);
  if (normalized.removed.length)
    throw new CheckoutError("item_unavailable", 409, {
      ids: normalized.removed,
    });
  const cart = priceCart(normalized.lines, deps.book, deps.rules);
  if (!cart.lines.length) throw new CheckoutError("empty_cart", 400);
  // The freight price is quoted again here; the browser's number is ignored.
  const quote = await quoteShipping(deps, {
    cep: input.address.cep,
    lines: normalized.lines,
  });
  const option = quote.options.find(
    (item) => item.id === input.shippingOptionId,
  );
  if (!option) throw new CheckoutError("shipping_changed", 409);
  const order = {
    id: randomUUID(),
    items: cart.lines.map((line) => ({
      id: line.id,
      name: line.item.name,
      label: line.item.label,
      quantity: line.quantity,
      unitPriceCents: line.item.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      skus: line.item.skus,
    })),
    shipping: {
      id: option.id,
      name: option.name,
      company: option.company,
      priceCents: option.chargedCents,
      days: option.days,
    },
    subtotalCents: cart.subtotalCents,
    shippingCents: option.chargedCents,
  };
  const totalCents = order.subtotalCents + order.shippingCents;
  let row: OrderRow;
  try {
    row = await deps.db.transaction(async (tx) => {
      const inserted = await tx.query<OrderRow>(
        `INSERT INTO orders (id, idempotency_key, request_hash, status, customer, address, items, shipping,
           subtotal_cents, shipping_cents, total_cents, payment_method)
         VALUES ($1, $2, $3, 'pending_payment', $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
        [
          order.id,
          input.idempotencyKey,
          requestHash,
          JSON.stringify(input.customer),
          JSON.stringify(input.address),
          JSON.stringify(order.items),
          JSON.stringify(order.shipping),
          order.subtotalCents,
          order.shippingCents,
          totalCents,
          input.payment.method,
        ],
      );
      if (!inserted.length)
        throw new CheckoutError("idempotency_conflict", 409);
      await reserve(tx, skuDemand(cart.lines));
      await event(tx, order.id, "order.created", {
        totalCents,
        method: input.payment.method,
      });
      return inserted[0];
    });
  } catch (error) {
    // A concurrent duplicate submission: answer with the order that won.
    if (error instanceof CheckoutError && error.code === "idempotency_conflict")
      return createCheckout(deps, raw);
    throw error;
  }
  log("order.created", {
    orderId: row.id,
    totalCents,
    method: input.payment.method,
  });
  return ensurePayment(deps, row, input);
}

// Creates the provider payment once per order. A retry with the same
// idempotency key after a network failure lands here and tries again.
async function ensurePayment(
  deps: Deps,
  order: OrderRow,
  input: CheckoutInput,
) {
  const current = await latestPayment(deps.db, order.id);
  if (!current && order.status === "pending_payment") {
    const [firstName, ...rest] = order.customer.name.split(/\s+/);
    const now = deps.now?.() ?? new Date();
    let payment: ProviderPayment;
    try {
      payment = await deps.payments.create({
        orderId: order.id,
        amountCents: order.total_cents,
        description: `Pedido Cura Café ${order.id.slice(0, 8)}`,
        payer: {
          email: order.customer.email,
          firstName,
          lastName: rest.join(" "),
          cpf: order.customer.cpf,
        },
        notificationUrl: `${deps.siteUrl}/api/webhooks/mercadopago/`,
        ...(input.payment.method === "pix"
          ? {
              method: "pix" as const,
              expiresAt: new Date(
                now.getTime() + deps.rules.pixExpirationMinutes * 60_000,
              ),
            }
          : {
              method: "card" as const,
              token: input.payment.token,
              paymentMethodId: input.payment.paymentMethodId,
              installments: input.payment.installments,
              issuerId: input.payment.issuerId ?? null,
            }),
      });
    } catch (error) {
      if (!(error instanceof GatewayError)) throw error;
      await event(deps.db, order.id, "payment.create_failed", {
        status: error.status,
      });
      log("payment.create_failed", { orderId: order.id, status: error.status });
      throw new CheckoutError("payment_unavailable", 502, {
        orderId: order.id,
      });
    }
    await recordPayment(deps, order.id, payment);
    if (input.payment.method === "pix")
      await notifyOrder(deps, order.id, "order_received");
  }
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
// with the same payment: unchanged states do nothing.
// With `webhookId`, the delivery is marked as handled in the same
// transaction, so a failure anywhere leaves it free for the provider's retry.
async function recordPayment(
  deps: Deps,
  orderId: string,
  payment: ProviderPayment,
  webhookId?: string,
) {
  const outcome = await deps.db.transaction(async (tx) => {
    if (webhookId) {
      const fresh = await tx.query(
        "INSERT INTO webhook_events (id, provider, resource_id) VALUES ($1, 'mercadopago', $2) ON CONFLICT (id) DO NOTHING RETURNING id",
        [webhookId, payment.id],
      );
      if (!fresh.length) return "duplicate" as const;
    }
    await tx.query(
      `INSERT INTO payments (provider_payment_id, order_id, method, status, status_detail, amount_cents,
         pix_qr_code, pix_qr_code_base64, pix_ticket_url, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (provider_payment_id) DO UPDATE SET status = EXCLUDED.status,
         status_detail = EXCLUDED.status_detail, updated_at = now()`,
      [
        payment.id,
        orderId,
        payment.method,
        payment.status,
        payment.statusDetail,
        payment.amountCents,
        payment.pix?.qrCode ?? null,
        payment.pix?.qrCodeBase64 ?? null,
        payment.pix?.ticketUrl ?? null,
        payment.expiresAt,
      ],
    );
    const order = (
      await tx.query<OrderRow>(
        "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
        [orderId],
      )
    )[0];
    return transition(tx, order, payment);
  });
  if (outcome === "duplicate") return outcome;
  if (outcome === "paid") await notifyOrder(deps, orderId, "payment_confirmed");
  if (outcome === "payment_failed")
    await notifyOrder(deps, orderId, "payment_failed");
  return outcome;
}

// Mercado Pago status → order status. Only the server, reading the provider,
// ever marks an order as paid.
async function transition(
  tx: Queryable,
  order: OrderRow,
  payment: ProviderPayment,
) {
  const target =
    payment.status === "approved"
      ? "paid"
      : payment.status === "rejected"
        ? "payment_failed"
        : payment.status === "cancelled" || payment.status === "expired"
          ? "cancelled"
          : payment.status === "refunded" || payment.status === "charged_back"
            ? "refunded"
            : null;
  if (!target || order.status === target) return null;
  // Fulfilment and refunds move forward only: a replayed "approved" never
  // takes a shipped, delivered or refunded order back to "paid", and only a
  // refund changes an order that already left.
  if (
    ["shipped", "delivered", "refunded"].includes(order.status) &&
    target !== "refunded"
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
    if (order.status !== "pending_payment") {
      // Paid after the reservation was released: stock must be checked by hand.
      await event(tx, order.id, "payment.approved_after_release", {
        from: order.status,
      });
    }
  }
  if (target === "payment_failed" || target === "cancelled")
    await release(tx, order);
  await tx.query(
    "UPDATE orders SET status = $2, updated_at = now() WHERE id = $1",
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

export async function handleMercadoPagoNotification(
  deps: Deps,
  input: { requestId: string; type: string | null; dataId: string },
) {
  if (input.type !== "payment")
    return { processed: false, reason: "ignored_type" };
  // Known delivery: skip it without calling the provider again.
  const seen = await deps.db.query(
    "SELECT 1 FROM webhook_events WHERE id = $1",
    [input.requestId],
  );
  if (seen.length) return { processed: false, reason: "duplicate" };
  // The notification only says "something changed": the state is read from
  // Mercado Pago itself, never taken from the notification body. A failure
  // here or below throws before anything is marked, so the retry is processed.
  const payment = await deps.payments.get(input.dataId);
  const order = (
    await deps.db.query<OrderRow>("SELECT id FROM orders WHERE id::text = $1", [
      payment.externalReference ?? "",
    ])
  )[0];
  if (!order) {
    log("webhook.unknown_order", { paymentId: payment.id });
    return { processed: false, reason: "unknown_order" };
  }
  const outcome = await recordPayment(deps, order.id, payment, input.requestId);
  return outcome === "duplicate"
    ? { processed: false, reason: "duplicate" }
    : { processed: true, outcome };
}

// Re-reads pending payments and releases stock of orders left unpaid (e.g. a
// Pix never paid, or a payment that failed to be created).
export async function reconcilePending(deps: Deps, olderThanMinutes: number) {
  const stale = await deps.db.query<{ id: string }>(
    "SELECT id FROM orders WHERE status = 'pending_payment' AND created_at < now() - ($1 || ' minutes')::interval",
    [String(olderThanMinutes)],
  );
  const results: Record<string, string | null> = {};
  for (const { id } of stale) {
    const payment = await latestPayment(deps.db, id);
    if (payment) {
      results[id] = await recordPayment(
        deps,
        id,
        await deps.payments.get(payment.provider_payment_id),
      );
      continue;
    }
    results[id] = await deps.db.transaction(async (tx) => {
      const order = (
        await tx.query<OrderRow>(
          "SELECT * FROM orders WHERE id = $1 FOR UPDATE",
          [id],
        )
      )[0];
      if (order.status !== "pending_payment") return null;
      await release(tx, order);
      await tx.query(
        "UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1",
        [id],
      );
      await event(tx, id, "order.cancelled", { reason: "no_payment" });
      return "cancelled";
    });
  }
  return results;
}

export async function markShipped(
  deps: Deps,
  orderId: string,
  tracking: { code: string; carrier: string | null },
) {
  const updated = await deps.db.transaction(async (tx) => {
    const rows = await tx.query<OrderRow>(
      "UPDATE orders SET status = 'shipped', tracking_code = $2, tracking_carrier = $3, updated_at = now() WHERE id = $1 AND status = 'paid' RETURNING *",
      [orderId, tracking.code, tracking.carrier],
    );
    if (rows.length)
      await event(tx, orderId, "order.shipped", { carrier: tracking.carrier });
    return rows.length > 0;
  });
  if (updated) await notifyOrder(deps, orderId, "order_shipped");
  return updated;
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
  return {
    id: order.id,
    ...(includeToken ? { token: orderToken(deps.tokenSecret, order.id) } : {}),
    status: order.status,
    createdAt: new Date(order.created_at).toISOString(),
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
    shipping: order.shipping,
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents,
    totalCents: order.total_cents,
    paymentMethod: order.payment_method,
    payment: payment
      ? {
          status: payment.status,
          statusDetail: payment.status_detail,
          pix:
            order.status === "pending_payment" && payment.pix_qr_code
              ? {
                  qrCode: payment.pix_qr_code,
                  qrCodeBase64: payment.pix_qr_code_base64,
                  ticketUrl: payment.pix_ticket_url,
                  expiresAt: payment.expires_at
                    ? new Date(payment.expires_at).toISOString()
                    : null,
                }
              : null,
        }
      : null,
    tracking: order.tracking_code
      ? { code: order.tracking_code, carrier: order.tracking_carrier }
      : null,
  };
}
export type OrderView = NonNullable<Awaited<ReturnType<typeof orderView>>>;

// Live availability per sellable item (kits need every SKU in stock).
export async function availability(
  deps: Pick<Deps, "db" | "book">,
  ids: string[],
) {
  const items = ids.map((id) => deps.book[id]).filter(Boolean);
  const skus = [
    ...new Set(items.flatMap((item) => item.skus.map((sku) => sku.sku))),
  ];
  const rows = skus.length
    ? await deps.db.query<{ sku: string; available: number }>(
        "SELECT sku, available FROM inventory WHERE sku = ANY($1)",
        [skus],
      )
    : [];
  const stock = new Map(rows.map((row) => [row.sku, row.available]));
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      // Units of this item that can still be bought.
      Math.min(
        ...item.skus.map((sku) =>
          Math.floor((stock.get(sku.sku) ?? 0) / sku.quantity),
        ),
      ),
    ]),
  );
}
