import type { Content } from "../content-schema";
// Client-safe. The "price book" lists only what can actually be sold: a
// published offer of a published lot and coffee, with a confirmed price and
// weight; or a published kit with an approved price whose items all qualify.
export type SellableItem = {
  id: string;
  kind: "offer" | "bundle";
  name: string;
  label: string;
  coffeeSlug: string | null;
  lotId: string | null;
  unitPriceCents: number;
  weightGrams: number;
  grind: string | null;
  // Stock units the item consumes; a kit consumes each of its offers' SKUs.
  skus: { sku: string; quantity: number }[];
};
export type PriceBook = Record<string, SellableItem>;
export function buildPriceBook(content: Content): PriceBook {
  const book: PriceBook = {};
  for (const offer of content.offers) {
    const lot = content.lots.find((item) => item.id === offer.lotId);
    const coffee = content.coffees.find((item) => item.id === lot?.coffeeId);
    if (
      offer.status !== "published" ||
      lot?.status !== "published" ||
      coffee?.status !== "published" ||
      offer.unitPriceInCents === null ||
      offer.weightInGrams === null
    )
      continue;
    book[offer.id] = {
      id: offer.id,
      kind: "offer",
      name: coffee.name,
      label: [`${offer.weightInGrams} g`, offer.grind]
        .filter(Boolean)
        .join(" · "),
      coffeeSlug: coffee.slug,
      lotId: lot.id,
      unitPriceCents: offer.unitPriceInCents,
      weightGrams: offer.weightInGrams,
      grind: offer.grind,
      skus: [{ sku: offer.sku, quantity: 1 }],
    };
  }
  for (const bundle of content.bundles) {
    const items = bundle.items.map((item) => ({
      ...item,
      offer: book[item.offerId],
    }));
    if (
      bundle.status !== "published" ||
      bundle.priceInCents === null ||
      items.some((item) => !item.offer)
    )
      continue;
    book[bundle.id] = {
      id: bundle.id,
      kind: "bundle",
      name: bundle.name,
      label: items
        .map(
          (item) => `${item.quantity}× ${item.offer.name} ${item.offer.label}`,
        )
        .join(" + "),
      coffeeSlug: null,
      lotId: null,
      unitPriceCents: bundle.priceInCents,
      weightGrams: items.reduce(
        (sum, item) => sum + item.offer.weightGrams * item.quantity,
        0,
      ),
      grind: null,
      skus: items.flatMap((item) =>
        item.offer.skus.map((sku) => ({
          sku: sku.sku,
          quantity: sku.quantity * item.quantity,
        })),
      ),
    };
  }
  return book;
}
export const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
// Price per 100 g, rounded to the cent, to compare package sizes fairly.
export const pricePer100g = (
  item: Pick<SellableItem, "unitPriceCents" | "weightGrams">,
) => Math.round((item.unitPriceCents * 100) / item.weightGrams);
