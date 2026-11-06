// E-commerce funnel events in the GA4 "ecommerce" shape, pushed to
// window.dataLayer. No analytics script is loaded by the site itself: a tag
// manager can be added only after the consent banner (LGPD) is defined.
export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_variant?: string;
  price: number;
  quantity: number;
};
type Window = { dataLayer?: unknown[] };
export function track(
  event:
    | "view_item"
    | "add_to_cart"
    | "remove_from_cart"
    | "view_cart"
    | "begin_checkout"
    | "add_shipping_info"
    | "add_payment_info"
    | "purchase",
  ecommerce: {
    currency?: "BRL";
    value?: number;
    items: AnalyticsItem[];
    [key: string]: unknown;
  },
) {
  if (typeof window === "undefined") return;
  const target = window as unknown as Window;
  target.dataLayer ??= [];
  target.dataLayer.push({ ecommerce: null });
  target.dataLayer.push({
    event,
    ecommerce: { currency: "BRL", ...ecommerce },
  });
}
export const centsToValue = (cents: number) => Math.round(cents) / 100;
