// Stock operations shared by the operations panel and the ops CLI. Every
// manual change is recorded with who made it and why.
import type { Content } from "../../content-schema";
import { sellabilityIssues, type PriceBook } from "../catalog";
import type { Db } from "./db";

export class StockError extends Error {}
export async function adjustStock(
  db: Db,
  input: {
    sku: string;
    // Either the new available quantity or a change (+/-).
    set?: number;
    delta?: number;
    reason: string;
    actor: string;
  },
  knownSkus: string[],
) {
  if (!knownSkus.includes(input.sku))
    throw new StockError(`SKU ${input.sku} não existe nas variantes do CMS.`);
  if (!input.reason.trim()) throw new StockError("Informe o motivo do ajuste.");
  return db.transaction(async (tx) => {
    const current =
      (
        await tx.query<{ available: number }>(
          "SELECT available FROM inventory WHERE sku = $1 FOR UPDATE",
          [input.sku],
        )
      )[0]?.available ?? 0;
    const next =
      input.set !== undefined ? input.set : current + (input.delta ?? 0);
    if (!Number.isInteger(next) || next < 0)
      throw new StockError("O estoque não pode ficar negativo.");
    await tx.query(
      `INSERT INTO inventory (sku, available) VALUES ($1, $2)
       ON CONFLICT (sku) DO UPDATE SET available = EXCLUDED.available, updated_at = now()`,
      [input.sku, next],
    );
    await tx.query(
      "INSERT INTO inventory_adjustments (sku, delta, available_after, reason, actor) VALUES ($1, $2, $3, $4, $5)",
      [
        input.sku,
        next - current,
        next,
        input.reason.trim().slice(0, 200),
        input.actor,
      ],
    );
    return { sku: input.sku, before: current, after: next };
  });
}
export async function setPaused(
  db: Db,
  sku: string,
  paused: boolean,
  actor: string,
  knownSkus: string[],
) {
  if (!knownSkus.includes(sku))
    throw new StockError(`SKU ${sku} não existe nas variantes do CMS.`);
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO inventory (sku, available, paused) VALUES ($1, 0, $2)
       ON CONFLICT (sku) DO UPDATE SET paused = EXCLUDED.paused, updated_at = now()`,
      [sku, paused],
    );
    const available =
      (
        await tx.query<{ available: number }>(
          "SELECT available FROM inventory WHERE sku = $1",
          [sku],
        )
      )[0]?.available ?? 0;
    await tx.query(
      "INSERT INTO inventory_adjustments (sku, delta, available_after, reason, actor) VALUES ($1, 0, $2, $3, $4)",
      [sku, available, paused ? "venda pausada" : "venda retomada", actor],
    );
  });
}
// One row per CMS variant: editorial state, what blocks the sale, live stock,
// units held by unpaid orders and units sold.
export async function stockReport(db: Db, content: Content, book: PriceBook) {
  const [inventory, held, sold] = await Promise.all([
    db.query<{ sku: string; available: number; paused: boolean }>(
      "SELECT sku, available, paused FROM inventory",
    ),
    unitsBySku(db, "status = 'pending_payment' AND NOT stock_released"),
    unitsBySku(db, "status = 'paid'"),
  ]);
  const stock = new Map(inventory.map((row) => [row.sku, row]));
  return content.offers
    .map((offer) => {
      const lot = content.lots.find((item) => item.id === offer.lotId);
      const coffee = content.coffees.find((item) => item.id === lot?.coffeeId);
      const row = stock.get(offer.sku);
      return {
        sku: offer.sku,
        offerId: offer.id,
        coffee: coffee?.name ?? "?",
        lot: lot?.code ?? "?",
        label: [
          offer.weightInGrams ? `${offer.weightInGrams} g` : null,
          offer.grind,
        ]
          .filter(Boolean)
          .join(" · "),
        status: offer.status,
        sellable: !!book[offer.id],
        issues: sellabilityIssues(content, offer),
        available: row?.available ?? null,
        paused: row?.paused ?? false,
        held: held.get(offer.sku) ?? 0,
        sold: sold.get(offer.sku) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        Number(b.sellable) - Number(a.sellable) ||
        a.coffee.localeCompare(b.coffee) ||
        a.sku.localeCompare(b.sku),
    );
}
async function unitsBySku(db: Db, where: string) {
  const orders = await db.query<{
    items: { quantity: number; skus: { sku: string; quantity: number }[] }[];
  }>(`SELECT items FROM orders WHERE ${where}`);
  const units = new Map<string, number>();
  for (const order of orders)
    for (const item of order.items)
      for (const sku of item.skus)
        units.set(
          sku.sku,
          (units.get(sku.sku) ?? 0) + sku.quantity * item.quantity,
        );
  return units;
}
