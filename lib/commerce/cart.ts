import type { PriceBook, SellableItem } from "./catalog";
import type { CommerceRules } from "./rules";
// Client-safe cart math. The browser uses it to show totals; the server runs
// the same code on its own price book and never trusts amounts it receives.
export type CartLine = { id: string; quantity: number };
export type PricedLine = CartLine & {
  item: SellableItem;
  lineTotalCents: number;
};
export function normalizeCart(
  lines: unknown,
  book: PriceBook,
  rules: Pick<CommerceRules, "maxQuantityPerLine">,
) {
  const merged = new Map<string, number>();
  const removed: string[] = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    const id = typeof line?.id === "string" ? line.id : null;
    const quantity = Number.isInteger(line?.quantity) ? line.quantity : 0;
    if (!id || quantity < 1 || !book[id]) {
      if (id) removed.push(id);
      continue;
    }
    merged.set(id, (merged.get(id) ?? 0) + quantity);
  }
  return {
    lines: [...merged].map(([id, quantity]) => ({
      id,
      quantity: Math.min(quantity, rules.maxQuantityPerLine),
    })),
    removed,
  };
}
export function priceCart(
  lines: CartLine[],
  book: PriceBook,
  rules: Pick<CommerceRules, "freeShippingFromCents">,
) {
  const priced: PricedLine[] = lines.flatMap((line) => {
    const item = book[line.id];
    return item
      ? [{ ...line, item, lineTotalCents: item.unitPriceCents * line.quantity }]
      : [];
  });
  const subtotalCents = priced.reduce(
    (sum, line) => sum + line.lineTotalCents,
    0,
  );
  return {
    lines: priced,
    subtotalCents,
    weightGrams: priced.reduce(
      (sum, line) => sum + line.item.weightGrams * line.quantity,
      0,
    ),
    itemCount: priced.reduce((sum, line) => sum + line.quantity, 0),
    freeShipping:
      rules.freeShippingFromCents !== null &&
      subtotalCents >= rules.freeShippingFromCents,
  };
}
// Total stock each SKU needs for the whole cart (kits expand to their SKUs).
export function skuDemand(lines: PricedLine[]) {
  const demand = new Map<string, number>();
  for (const line of lines)
    for (const sku of line.item.skus)
      demand.set(
        sku.sku,
        (demand.get(sku.sku) ?? 0) + sku.quantity * line.quantity,
      );
  return demand;
}
