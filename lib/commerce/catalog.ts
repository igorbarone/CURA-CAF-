import type { Content, Lot, Offer } from "../content-schema";
// Client-safe. The "price book" lists only what can actually be sold: a
// published offer of a published lot and coffee, with a confirmed price, net
// and gross weight and package dimensions; or a published kit with an
// approved price whose items all qualify. Publication flow:
//   Rascunho (draft) → Validação (sellabilityIssues) → Publicação (status
//   published, commit) → Disponibilidade (stock, pause and sale window,
//   checked at request time by the store).
export type PackedUnit = {
  sku: string;
  grossGrams: number;
  // Package dimensions of one unit, in cm.
  heightCm: number;
  widthCm: number;
  lengthCm: number;
};
export type SaleWindow = { startsAt: string | null; endsAt: string | null };
export type SellableItem = {
  id: string;
  kind: "offer" | "bundle";
  name: string;
  label: string;
  coffeeSlug: string | null;
  lotId: string | null;
  // Price charged (promotional when approved) and the regular price.
  unitPriceCents: number;
  listPriceCents: number;
  weightGrams: number;
  grind: string | null;
  commercialLabel: string | null;
  minQuantity: number;
  maxQuantity: number | null;
  // Every packed unit one item ships as (a kit ships as its offers' units).
  packing: { unit: PackedUnit; quantity: number }[];
  // Sale windows to respect at request time (offer and lot).
  windows: SaleWindow[];
  // Package image shown in cart, mini-cart and checkout (null: none published).
  image: { src: string; alt: string } | null;
  // Stock units the item consumes; a kit consumes each of its offers' SKUs.
  skus: { sku: string; quantity: number }[];
};
export type PriceBook = Record<string, SellableItem>;
// What still blocks the sale of an offer. Drafts may be incomplete; a
// published offer with issues stays visible but is not sold.
export function sellabilityIssues(
  content: Pick<Content, "coffees" | "lots">,
  offer: Offer,
) {
  const lot = content.lots.find((item) => item.id === offer.lotId);
  const coffee = content.coffees.find((item) => item.id === lot?.coffeeId);
  const issues: string[] = [];
  if (offer.status !== "published") issues.push("oferta não publicada");
  if (lot?.status !== "published") issues.push("lote não publicado");
  if (coffee?.status !== "published") issues.push("café não publicado");
  if (!offer.sku.trim()) issues.push("sem SKU");
  if (offer.unitPriceInCents === null || offer.unitPriceInCents <= 0)
    issues.push("sem preço");
  if (offer.weightInGrams === null) issues.push("sem peso líquido");
  if (offer.grossWeightInGrams === null) issues.push("sem peso bruto embalado");
  if (
    offer.packageHeightCm === null ||
    offer.packageWidthCm === null ||
    offer.packageLengthCm === null
  )
    issues.push("sem dimensões da embalagem");
  return issues;
}
export const saleWindows = (offer: Offer, lot: Lot): SaleWindow[] =>
  [
    { startsAt: offer.saleStartsAt, endsAt: offer.saleEndsAt },
    { startsAt: lot.saleStartsAt, endsAt: lot.saleEndsAt },
  ].filter((window) => window.startsAt || window.endsAt);
// Brasília calendar date of an instant (sale windows are whole days there).
export const brasiliaDate = (now: Date) =>
  new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
export function onSale(item: Pick<SellableItem, "windows">, now: Date) {
  const today = brasiliaDate(now);
  return item.windows.every(
    (window) =>
      (!window.startsAt || window.startsAt <= today) &&
      (!window.endsAt || today <= window.endsAt),
  );
}
export function buildPriceBook(content: Content): PriceBook {
  const book: PriceBook = {};
  for (const offer of content.offers) {
    const lot = content.lots.find((item) => item.id === offer.lotId);
    const coffee = content.coffees.find((item) => item.id === lot?.coffeeId);
    if (!lot || !coffee || sellabilityIssues(content, offer).length) continue;
    const price = offer.unitPriceInCents as number;
    book[offer.id] = {
      id: offer.id,
      kind: "offer",
      name: coffee.name,
      label: [`${offer.weightInGrams} g`, offer.grind]
        .filter(Boolean)
        .join(" · "),
      coffeeSlug: coffee.slug,
      lotId: lot.id,
      unitPriceCents: offer.promoPriceInCents ?? price,
      listPriceCents: price,
      weightGrams: offer.weightInGrams as number,
      grind: offer.grind,
      commercialLabel: offer.commercialLabel,
      minQuantity: offer.minQuantity ?? 1,
      maxQuantity: offer.maxQuantity,
      packing: [
        {
          unit: {
            sku: offer.sku,
            grossGrams: offer.grossWeightInGrams as number,
            heightCm: offer.packageHeightCm as number,
            widthCm: offer.packageWidthCm as number,
            lengthCm: offer.packageLengthCm as number,
          },
          quantity: 1,
        },
      ],
      windows: saleWindows(offer, lot),
      image:
        coffee.media &&
        (coffee.media.lotId === lot.id ||
          (!coffee.media.lotId && coffee.media.kind === "photograph"))
          ? { src: coffee.media.src, alt: coffee.media.alt }
          : null,
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
      listPriceCents: bundle.priceInCents,
      commercialLabel: null,
      minQuantity: 1,
      maxQuantity: null,
      packing: items.flatMap((item) =>
        item.offer.packing.map((entry) => ({
          unit: entry.unit,
          quantity: entry.quantity * item.quantity,
        })),
      ),
      windows: items.flatMap((item) => item.offer.windows),
      weightGrams: items.reduce(
        (sum, item) => sum + item.offer.weightGrams * item.quantity,
        0,
      ),
      grind: null,
      image: items.find((item) => item.offer.image)?.offer.image ?? null,
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
