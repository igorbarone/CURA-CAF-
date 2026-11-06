"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  normalizeCart,
  priceCart,
  type CartLine,
} from "../../lib/commerce/cart";
import type { PriceBook } from "../../lib/commerce/catalog";
import type { CommerceRules } from "../../lib/commerce/rules";
import { centsToValue, track } from "../../lib/analytics";
// Persistent cart: only item ids and quantities are stored in the browser.
// Prices shown here are recomputed from the published price book, and the
// server recomputes them again at checkout.
const KEY = "cura-cart-v1";
type Cart = ReturnType<typeof priceCart> & {
  ready: boolean;
  book: PriceBook;
  rules: CommerceRules;
  add: (id: string, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};
const CartContext = createContext<Cart | null>(null);
export function CartProvider({
  book,
  rules,
  children,
}: {
  book: PriceBook;
  rules: CommerceRules;
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setLines(
        normalizeCart(
          JSON.parse(localStorage.getItem(KEY) ?? "[]"),
          book,
          rules,
        ).lines,
      );
    } catch {
      /* Storage blocked or corrupt: start with an empty cart. */
    }
    setReady(true);
  }, [book, rules]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* The cart still works for this visit. */
    }
  }, [lines, ready]);
  const priced = useMemo(
    () => priceCart(lines, book, rules),
    [lines, book, rules],
  );
  // Functional updates: several calls in one event (e.g. "Comprar
  // novamente" with many items) all build on the latest cart.
  const update = (next: (current: CartLine[]) => CartLine[]) =>
    setLines((current) => normalizeCart(next(current), book, rules).lines);
  const value: Cart = {
    ...priced,
    ready,
    book,
    rules,
    add(id, quantity = 1) {
      const item = book[id];
      if (!item) return;
      update((current) => [...current, { id, quantity }]);
      track("add_to_cart", {
        value: centsToValue(item.unitPriceCents * quantity),
        items: [
          {
            item_id: id,
            item_name: item.name,
            item_variant: item.label,
            price: centsToValue(item.unitPriceCents),
            quantity,
          },
        ],
      });
    },
    setQuantity(id, quantity) {
      update((current) =>
        quantity < 1
          ? current.filter((line) => line.id !== id)
          : current.map((line) => (line.id === id ? { id, quantity } : line)),
      );
    },
    remove(id) {
      const line = priced.lines.find((item) => item.id === id);
      update((current) => current.filter((item) => item.id !== id));
      if (line)
        track("remove_from_cart", {
          value: centsToValue(line.lineTotalCents),
          items: [
            {
              item_id: id,
              item_name: line.item.name,
              price: centsToValue(line.item.unitPriceCents),
              quantity: line.quantity,
            },
          ],
        });
    },
    clear: () => setLines([]),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart fora do CartProvider");
  return cart;
}
export const useOptionalCart = () => useContext(CartContext);
