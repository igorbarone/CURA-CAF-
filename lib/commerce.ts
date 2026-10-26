import type { Offer } from "./content-schema";
// An editorial offer is not proof that an item can be purchased or reserved.
export type CartLineReference = { offerId: Offer["id"]; quantity: number };
export const commerce = {
  status: "unconfigured",
  checkoutEnabled: false,
} as const;
