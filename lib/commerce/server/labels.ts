// Melhor Envio labels, bought only by an explicit action in the operations
// panel (never automatically). One shipment row per order (primary key) and a
// row lock make a double click or a parallel request unable to buy twice;
// each step is saved, so a retry resumes where it stopped instead of
// starting over.
import type { Volume } from "../packing";
import type { Queryable } from "./db";
import { log } from "./log";
import {
  advanceFulfillment,
  CheckoutError,
  event,
  orderUrl,
  type Deps,
  type OrderRow,
} from "./orders";
import { ShippingError, type Address } from "./shipping";

export type LabelDeps = Deps & {
  labels: { sender: Address; nonCommercial: boolean } | null;
};
type ShipmentRow = {
  order_id: string;
  status:
    "creating" | "in_cart" | "purchased" | "generated" | "failed" | "cancelled";
  service_id: string;
  provider_ids: string[];
  tracking_codes: (string | null)[];
  label_url: string | null;
  cost_cents: number | null;
  error: string | null;
};
export async function shipmentOf(db: Queryable, orderId: string) {
  return (
    await db.query<ShipmentRow>("SELECT * FROM shipments WHERE order_id = $1", [
      orderId,
    ])
  )[0];
}
// Claims the label purchase for one order. A second caller gets "busy".
async function claim(deps: Deps, order: OrderRow) {
  return deps.db.transaction(async (tx) => {
    await tx.query("SELECT id FROM orders WHERE id = $1 FOR UPDATE", [
      order.id,
    ]);
    const current = await shipmentOf(tx, order.id);
    if (!current) {
      await tx.query(
        "INSERT INTO shipments (order_id, status, service_id) VALUES ($1, 'creating', $2)",
        [order.id, order.shipping.id],
      );
      return { row: await shipmentOf(tx, order.id), fresh: true };
    }
    if (current.status === "generated" || current.status === "cancelled")
      return { row: current, fresh: false };
    // Someone else is on it right now (no error, touched in the last two
    // minutes): do not run the steps twice in parallel.
    const busy = await tx.query(
      "SELECT 1 FROM shipments WHERE order_id = $1 AND error IS NULL AND updated_at > now() - interval '2 minutes'",
      [order.id],
    );
    if (busy.length) return { row: current, fresh: false };
    // A failed or interrupted attempt: resume from the last saved step.
    await tx.query(
      "UPDATE shipments SET error = NULL, updated_at = now() WHERE order_id = $1",
      [order.id],
    );
    return { row: current, fresh: true };
  });
}
const save = (
  db: Queryable,
  orderId: string,
  fields: Partial<Omit<ShipmentRow, "order_id">>,
) => {
  const entries = Object.entries(fields);
  return db.query(
    `UPDATE shipments SET ${entries
      .map(([key], index) => `${key} = $${index + 2}`)
      .join(", ")}, updated_at = now() WHERE order_id = $1`,
    [
      orderId,
      ...entries.map(([, value]) =>
        Array.isArray(value) ? JSON.stringify(value) : value,
      ),
    ],
  );
};
export async function buyLabel(
  deps: LabelDeps,
  orderId: string,
  { invoiceKey }: { invoiceKey: string | null },
) {
  if (!deps.labels) throw new CheckoutError("shipping_unavailable", 503);
  const order = (
    await deps.db.query<OrderRow>("SELECT * FROM orders WHERE id = $1", [
      orderId,
    ])
  )[0];
  if (!order) throw new CheckoutError("not_found", 404);
  if (
    order.status !== "paid" ||
    !["unfulfilled", "preparing"].includes(order.fulfillment_status)
  )
    throw new CheckoutError("invalid_transition", 409, {
      status: order.status,
      fulfillment: order.fulfillment_status,
    });
  if (!invoiceKey && !deps.labels.nonCommercial)
    throw new CheckoutError("invalid_input", 400, { field: "invoiceKey" });
  const { row, fresh } = await claim(deps, order);
  if (!fresh) return row;
  const to: Address = {
    name: order.customer.name,
    phone: order.customer.phone,
    email: order.customer.email,
    document: order.customer.cpf,
    street: order.address.street,
    number: order.address.number,
    complement: order.address.complement,
    district: order.address.district,
    city: order.address.city,
    state: order.address.state,
    postalCode: order.address.cep,
  };
  const itemName = new Map(
    order.items.flatMap((item) =>
      item.skus.map((sku) => [sku.sku, `${item.name} ${item.label}`] as const),
    ),
  );
  const unitValue = new Map(
    order.items.flatMap((item) =>
      item.skus.map(
        (sku) =>
          [
            sku.sku,
            item.unitPriceCents /
              100 /
              item.skus.reduce((n, entry) => n + entry.quantity, 0),
          ] as const,
      ),
    ),
  );
  try {
    let ids = row.provider_ids;
    let cost = row.cost_cents ?? 0;
    // One cart entry per volume; volumes already in the cart are kept.
    for (const [index, volume] of (order.volumes as Volume[]).entries()) {
      if (ids[index]) continue;
      const created = await deps.shipping.addToCart({
        orderId,
        serviceId: order.shipping.id,
        from: deps.labels.sender,
        to,
        volume,
        products: volume.items.map((item) => ({
          name: itemName.get(item.sku) ?? item.sku,
          quantity: item.quantity,
          unitaryValue: Number((unitValue.get(item.sku) ?? 0).toFixed(2)),
        })),
        invoiceKey,
        nonCommercial: !invoiceKey && deps.labels.nonCommercial,
        orderUrl: orderUrl(deps, orderId),
      });
      ids = [...ids, created.id];
      cost += created.priceCents;
      await save(deps.db, orderId, {
        provider_ids: ids,
        cost_cents: cost,
        status: "in_cart",
      });
    }
    // The status is the last completed step: a label is paid only once.
    if (row.status !== "purchased") {
      await deps.shipping.checkout(ids);
      await save(deps.db, orderId, { status: "purchased" });
      await event(deps.db, orderId, "label.purchased", {
        volumes: ids.length,
        costCents: cost,
      });
    }
    await deps.shipping.generate(ids);
    const url = await deps.shipping.print(ids);
    const tracking = await deps.shipping.tracking(ids);
    const codes = ids.map((id) => tracking[id] ?? null);
    await save(deps.db, orderId, {
      status: "generated",
      label_url: url,
      tracking_codes: codes,
    });
    await event(deps.db, orderId, "label.generated", { volumes: ids.length });
    if (order.fulfillment_status === "unfulfilled")
      await advanceFulfillment(deps, orderId, "preparing");
    log("label.generated", { orderId, volumes: ids.length });
  } catch (error) {
    const message =
      error instanceof ShippingError
        ? error.message
        : error instanceof Error
          ? error.message
          : "erro";
    // The status keeps the last completed step; only the error is saved.
    await save(deps.db, orderId, { error: message });
    await event(deps.db, orderId, "label.failed", { message });
    log("label.failed", { orderId, message });
    if (!(error instanceof ShippingError)) throw error;
  }
  return shipmentOf(deps.db, orderId);
}
// Tracking codes appear some time after generation; refresh on demand and
// mark the order as shipped when every volume has one.
export async function refreshTracking(deps: LabelDeps, orderId: string) {
  const row = await shipmentOf(deps.db, orderId);
  if (!row || row.status !== "generated") return row;
  const tracking = await deps.shipping.tracking(row.provider_ids);
  const codes = row.provider_ids.map((id) => tracking[id] ?? null);
  await save(deps.db, orderId, { tracking_codes: codes });
  if (codes.every(Boolean)) {
    const order = (
      await deps.db.query<OrderRow>("SELECT * FROM orders WHERE id = $1", [
        orderId,
      ])
    )[0];
    if (
      order.fulfillment_status !== "shipped" &&
      order.fulfillment_status !== "delivered"
    )
      await advanceFulfillment(deps, orderId, "shipped", {
        code: codes.join(", "),
        carrier: order.shipping.company || null,
      });
  }
  return shipmentOf(deps.db, orderId);
}
