"use client";
import Link from "next/link";
import { PackThumb } from "./pack-thumb";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { formatBRL } from "../../lib/commerce/catalog";
import { Arrow } from "../arrow";
import { useCart } from "./cart-provider";
// Confirmation after "Adicionar": what was added, the cart so far and the
// next step (finish or keep choosing). Non-modal, closes with Esc, and gives
// focus back to the button that opened it.
export function CartNotice() {
  const cart = useCart();
  const pathname = usePathname();
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const hidden = /^\/(carrinho|checkout|pedido)\//.test(pathname ?? "");
  const notice = !hidden ? cart.notice : null;
  const item = notice ? cart.book[notice.id] : null;
  useEffect(() => {
    if (!notice) return;
    opener.current = document.activeElement as HTMLElement | null;
    heading.current?.focus();
  }, [notice]);
  // Leaving the page closes it, so it never follows the visitor around.
  useEffect(() => cart.dismissNotice, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!notice || !item) return null;
  const close = () => {
    cart.dismissNotice();
    opener.current?.focus?.();
  };
  return (
    <aside
      className="cart-notice"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cart-notice-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <div className="cart-notice-head">
        <h2 id="cart-notice-title" ref={heading} tabIndex={-1}>
          <span aria-hidden="true">✓</span> Adicionado ao carrinho
        </h2>
        <button
          type="button"
          className="cart-notice-close"
          aria-label="Fechar"
          onClick={close}
        >
          ×
        </button>
      </div>
      <div className="cart-notice-line">
        <PackThumb item={item} size={52} />
        <p className="cart-notice-item">
          {notice.quantity}× {item.name} · {item.label} ·{" "}
          {formatBRL(item.unitPriceCents * notice.quantity)}
        </p>
      </div>
      <p className="cart-notice-total mono">
        {cart.itemCount} {cart.itemCount === 1 ? "ITEM" : "ITENS"} NO CARRINHO ·{" "}
        SUBTOTAL {formatBRL(cart.subtotalCents)}
      </p>
      <div className="cart-notice-actions">
        <Link className="button" href="/checkout/">
          Finalizar compra <Arrow />
        </Link>
        <Link className="text-link" href="/carrinho/">
          Ver carrinho
        </Link>
        <button type="button" className="text-link" onClick={close}>
          Continuar escolhendo
        </button>
      </div>
    </aside>
  );
}
