import type { ClientRules } from "./rules";
// Client-safe money rules shared by the cart, the checkout screen and the
// server. The server always recomputes them; the browser only displays.
export type PaymentMethod = "pix" | "card";
// Pix discount applies to the coffee subtotal only, never to freight.
export function pixDiscountCents(
  subtotalCents: number,
  rules: Pick<ClientRules, "pixDiscountPercent">,
) {
  return Math.round((subtotalCents * rules.pixDiscountPercent) / 100);
}
// Freight the buyer pays: the quoted price, minus an approved subsidy or free
// shipping rule (both off while null). Never below zero.
export function chargedShippingCents(
  quotedCents: number,
  subtotalCents: number,
  rules: Pick<ClientRules, "freeShippingFromCents" | "shippingSubsidyCents">,
) {
  if (
    rules.freeShippingFromCents !== null &&
    subtotalCents >= rules.freeShippingFromCents
  )
    return 0;
  return Math.max(0, quotedCents - (rules.shippingSubsidyCents ?? 0));
}
export function orderTotals(input: {
  subtotalCents: number;
  shippingCents: number;
  method: PaymentMethod;
  rules: Pick<ClientRules, "pixDiscountPercent">;
}) {
  const discountCents =
    input.method === "pix"
      ? pixDiscountCents(input.subtotalCents, input.rules)
      : 0;
  return {
    discountCents,
    totalCents: input.subtotalCents - discountCents + input.shippingCents,
  };
}
