import type { PriceBook, SellableItem } from "./catalog";
import { pricePer100g } from "./catalog";
// Upsell and cross-sell are derived only from what is really for sale: no
// invented discount, urgency or benefit. Each suggestion says why it appears.
export type Suggestion = { item: SellableItem; reason: string };
// Same lot and grind in a bigger package, shown only when it really costs
// less per 100 g; otherwise a bigger bag is not suggested as an advantage.
export function largerPackage(book: PriceBook, current: SellableItem) {
  if (current.kind !== "offer") return null;
  const candidates = Object.values(book)
    .filter(
      (item) =>
        item.kind === "offer" &&
        item.lotId === current.lotId &&
        item.grind === current.grind &&
        item.weightGrams > current.weightGrams &&
        pricePer100g(item) < pricePer100g(current),
    )
    .sort((a, b) => a.weightGrams - b.weightGrams);
  return candidates[0]
    ? {
        item: candidates[0],
        reason: "Mesmo café em embalagem maior, com menor preço por 100 g.",
      }
    : null;
}
// Other coffees (one offer each, the lightest), and kits containing the coffee.
export function crossSell(
  book: PriceBook,
  coffeeSlugs: (string | null)[],
  excludeIds: string[] = [],
): Suggestion[] {
  const items = Object.values(book).filter(
    (item) => !excludeIds.includes(item.id),
  );
  const kits = items
    .filter((item) => item.kind === "bundle")
    .map((item) => ({ item, reason: "Kit para conhecer perfis diferentes." }));
  const others = new Map<string, SellableItem>();
  for (const item of items)
    if (
      item.kind === "offer" &&
      item.coffeeSlug &&
      !coffeeSlugs.includes(item.coffeeSlug)
    ) {
      const best = others.get(item.coffeeSlug);
      if (!best || item.weightGrams < best.weightGrams)
        others.set(item.coffeeSlug, item);
    }
  return [
    ...kits,
    ...[...others.values()].map((item) => ({
      item,
      reason: "Experimente outro perfil da curadoria.",
    })),
  ];
}
