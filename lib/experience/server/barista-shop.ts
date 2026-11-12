// Commercial snapshot for the Barista's consultarCompra tool: the store's
// own price book (published, sellable variants) and live availability.
// Cached briefly so a conversation costs at most one stock query a minute.
import { buildPriceBook } from "../../commerce/catalog";
import { getCommerceRules } from "../../commerce/rules";
import { readConfig } from "../../commerce/server/config";
import { availability } from "../../commerce/server/orders";
import { runtime } from "../../commerce/server/runtime";
import { loadContent } from "../../content-loader";
import type { ShopSnapshot } from "../barista-tools";

const TTL_MS = 60_000;
let cached: { at: number; value: ShopSnapshot } | null = null;
export async function loadShop(now = Date.now()): Promise<ShopSnapshot> {
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const config = readConfig();
  const online = config.enabled && config.payments && config.shipping;
  const book = buildPriceBook(loadContent());
  const offers = Object.values(book).filter(
    (item) => item.kind === "offer" && item.coffeeSlug,
  );
  let units: Record<string, number> | null = null;
  if (online) {
    try {
      const { deps } = await runtime();
      units = await availability(
        deps,
        offers.map((offer) => offer.id),
      );
    } catch {
      units = null;
    }
  }
  const value: ShopSnapshot = {
    online,
    pixDiscountPercent: getCommerceRules().pixDiscountPercent,
    offers: offers.map((offer) => ({
      coffeeSlug: offer.coffeeSlug as string,
      label: offer.label,
      priceCents: offer.unitPriceCents,
      listPriceCents: offer.listPriceCents,
      units: units ? (units[offer.id] ?? 0) : null,
    })),
  };
  cached = { at: now, value };
  return value;
}
