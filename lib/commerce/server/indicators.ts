// Operational indicators for the panel. Plain sums over paid orders; card
// fees are an estimate (internal assumption from the CMS), never charged.
import type { CommerceRules } from "../rules";
import type { Db } from "./db";

export async function indicators(
  db: Db,
  rules: Pick<CommerceRules, "cardFeeAssumptionPercent">,
  { days }: { days: number | null },
) {
  const params = days === null ? [] : [String(days)];
  const paidSince =
    days === null ? "" : "AND paid_at >= now() - ($1 || ' days')::interval";
  const createdSince =
    days === null
      ? ""
      : "WHERE created_at >= now() - ($1 || ' days')::interval";
  const [paid] = await db.query<{
    orders: string;
    gross: string | null;
    discounts: string | null;
    shipping: string | null;
    card_total: string | null;
    pix_orders: string;
    card_orders: string;
  }>(
    `SELECT count(*) AS orders, sum(total_cents) AS gross, sum(discount_cents) AS discounts,
       sum(shipping_cents) AS shipping,
       sum(CASE WHEN payment_method = 'card' THEN total_cents ELSE 0 END) AS card_total,
       count(*) FILTER (WHERE payment_method = 'pix') AS pix_orders,
       count(*) FILTER (WHERE payment_method = 'card') AS card_orders
     FROM orders WHERE status = 'paid' ${paidSince}`,
    params,
  );
  const byState = await db.query<{ status: string; count: string }>(
    `SELECT status, count(*) AS count FROM orders ${createdSince} GROUP BY status`,
    params,
  );
  const [toShip] = await db.query<{ count: string }>(
    "SELECT count(*) AS count FROM orders WHERE status = 'paid' AND fulfillment_status IN ('unfulfilled', 'preparing')",
  );
  const [attention] = await db.query<{ count: string }>(
    `SELECT count(DISTINCT order_id) AS count FROM order_events
     WHERE type IN ('payment.paid_without_stock', 'payment.amount_mismatch')`,
  );
  const orders = Number(paid.orders);
  const gross = Number(paid.gross ?? 0);
  const cardTotal = Number(paid.card_total ?? 0);
  return {
    paidOrders: orders,
    pixOrders: Number(paid.pix_orders),
    cardOrders: Number(paid.card_orders),
    grossCents: gross,
    pixDiscountCents: Number(paid.discounts ?? 0),
    shippingChargedCents: Number(paid.shipping ?? 0),
    estimatedCardFeesCents: Math.round(
      (cardTotal * rules.cardFeeAssumptionPercent) / 100,
    ),
    averageTicketCents: orders ? Math.round(gross / orders) : 0,
    byStatus: Object.fromEntries(
      byState.map((row) => [row.status, Number(row.count)]),
    ),
    toShip: Number(toShip.count),
    needsAttention: Number(attention.count),
  };
}
