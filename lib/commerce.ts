/** Future commerce boundary. Editorial data never establishes a sellable offer. */
export type ConfirmedOffer = {
  sku: string;
  currency: "BRL";
  unitPriceInCents: number;
  availableQuantity: number;
  weightInGrams: number;
  grind: string;
};
export type CartLine = {
  productSlug: string;
  offer: ConfirmedOffer;
  quantity: number;
};
// No offers exist until a real commerce provider confirms price, inventory and variants.
export const commerce = {
  status: "unconfigured",
  checkoutEnabled: false,
} as const;
