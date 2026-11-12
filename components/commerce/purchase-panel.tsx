"use client";
import Link from "next/link";
import { PackThumb } from "./pack-thumb";
import { useEffect, useRef, useState } from "react";
import {
  formatBRL,
  pricePer100g,
  type SellableItem,
} from "../../lib/commerce/catalog";
import { largerPackage } from "../../lib/commerce/recommendations";
import { lineLimit } from "../../lib/commerce/cart";
import { centsToValue, track } from "../../lib/analytics";
import { Arrow } from "../arrow";
import { useCart } from "./cart-provider";
import { QuantityInput } from "./quantity-input";
import { useAvailability } from "./use-availability";
// Purchase box of the product page (commerce runtime only). Lists the
// packages of the selected lot that are really for sale, with live stock.
export function PurchasePanel({
  coffeeName,
  coffeeSlug,
  lotId,
}: {
  coffeeName: string;
  coffeeSlug: string;
  lotId: string | null;
}) {
  const cart = useCart();
  const packages = Object.values(cart.book)
    .filter((item) => item.kind === "offer" && item.lotId === lotId)
    .sort((a, b) => a.weightGrams - b.weightGrams);
  const kitIds = Object.values(cart.book)
    .filter(
      (item) =>
        item.kind === "bundle" &&
        item.skus.some((sku) =>
          Object.values(cart.book).some(
            (offer) =>
              offer.kind === "offer" &&
              offer.coffeeSlug === coffeeSlug &&
              offer.skus[0].sku === sku.sku,
          ),
        ),
    )
    .map((item) => item.id);
  const [selectedId, setSelectedId] = useState(packages[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState("");
  // Mobile bar with price and "Adicionar" while the panel's own button is off
  // screen (the visitor scrolled to the details or the producer).
  const addButton = useRef<HTMLButtonElement>(null);
  const [buttonVisible, setButtonVisible] = useState(true);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const button = addButton.current;
    if (!button || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setButtonVisible(entry.isIntersecting),
    );
    observer.observe(button);
    return () => observer.disconnect();
  });
  const { units, failed } = useAvailability([
    ...packages.map((item) => item.id),
    ...kitIds,
  ]);
  const selected =
    packages.find((item) => item.id === selectedId) ?? packages[0];
  useEffect(() => {
    if (packages[0] && !packages.some((item) => item.id === selectedId))
      setSelectedId(packages[0].id);
  }, [packages, selectedId]);
  useEffect(() => {
    if (selected)
      track("view_item", {
        value: centsToValue(selected.unitPriceCents),
        items: [
          {
            item_id: selected.id,
            item_name: selected.name,
            item_variant: selected.label,
            price: centsToValue(selected.unitPriceCents),
            quantity: 1,
          },
        ],
      });
    // Once per package shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);
  if (!selected)
    return (
      <aside className="commerce-status" aria-label="Informações comerciais">
        <p className="eyebrow">COMPRA ONLINE EM BREVE</p>
        <p>
          As embalagens deste lote ainda não estão à venda pelo site. Assim que
          os dados de envio forem confirmados, a compra abre aqui.
        </p>
      </aside>
    );
  const stockOf = (item: SellableItem) =>
    units ? (units[item.id] ?? 0) : null;
  const available = stockOf(selected);
  const limit = lineLimit(selected, cart.rules);
  const max = Math.min(limit, available ?? limit);
  const upsell = largerPackage(cart.book, selected);
  const add = (item: SellableItem, count: number) => {
    cart.add(item.id, count);
    setAdded(`${count}× ${item.name} ${item.label} no carrinho.`);
  };
  return (
    <aside className="purchase-panel" aria-label={`Comprar ${coffeeName}`}>
      <fieldset>
        <legend>Escolha a embalagem</legend>
        {packages.map((item) => {
          const stock = stockOf(item);
          return (
            <label key={item.id} className="package-option">
              <input
                type="radio"
                name="package"
                value={item.id}
                checked={item.id === selected.id}
                onChange={() => {
                  setSelectedId(item.id);
                  setQuantity(1);
                }}
              />
              <span className="package-label">
                {item.label}
                {item.commercialLabel && (
                  <small className="package-tag"> {item.commercialLabel}</small>
                )}
              </span>
              <span className="package-price">
                {item.listPriceCents > item.unitPriceCents && (
                  <del
                    aria-label={`Preço normal ${formatBRL(item.listPriceCents)}`}
                  >
                    {formatBRL(item.listPriceCents)}
                  </del>
                )}{" "}
                {formatBRL(item.unitPriceCents)}
              </span>
              <span className="package-unit mono">
                {formatBRL(pricePer100g(item))} / 100 g
                {stock === 0 && " · indisponível"}
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="purchase-availability" role="status">
        {available === null
          ? failed
            ? "Disponibilidade confirmada ao finalizar a compra."
            : "Consultando disponibilidade…"
          : available > 0
            ? "Disponível para envio."
            : "Indisponível no momento."}
      </p>
      <div className="purchase-row">
        <QuantityInput
          id="purchase-quantity"
          label="Quantidade"
          value={Math.min(quantity, Math.max(max, 1))}
          max={Math.max(max, 1)}
          onChange={setQuantity}
        />
        <p className="purchase-total">
          <span className="mono">TOTAL</span>
          {formatBRL(selected.unitPriceCents * quantity)}
        </p>
      </div>
      <button
        ref={addButton}
        type="button"
        className="button purchase-add"
        disabled={available === 0}
        onClick={() => add(selected, quantity)}
      >
        Adicionar ao carrinho
      </button>
      {narrow && !buttonVisible && !cart.notice && (
        <div className="purchase-sticky" aria-hidden="true">
          <PackThumb item={selected} size={36} />
          <p>
            <span>
              {quantity}× {selected.label}
            </span>
            <strong>{formatBRL(selected.unitPriceCents * quantity)}</strong>
          </p>
          <button
            type="button"
            className="button"
            tabIndex={-1}
            disabled={available === 0}
            onClick={() => add(selected, quantity)}
          >
            Adicionar
          </button>
        </div>
      )}
      <p role="status" className="selection-feedback">
        {added && (
          <>
            {added}{" "}
            <Link href="/carrinho/" className="text-link">
              Ver carrinho <Arrow />
            </Link>
          </>
        )}
      </p>
      {upsell && stockOf(upsell.item) !== 0 && (
        <div className="purchase-suggestion">
          <p>
            <strong>{upsell.item.label}</strong> por{" "}
            {formatBRL(upsell.item.unitPriceCents)} ·{" "}
            {formatBRL(pricePer100g(upsell.item))} / 100 g. {upsell.reason}
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() => add(upsell.item, 1)}
          >
            Adicionar {upsell.item.label}
          </button>
        </div>
      )}
      {kitIds.map((id) => {
        const kit = cart.book[id];
        return (
          stockOf(kit) !== 0 && (
            <div key={id} className="purchase-suggestion">
              <p>
                <strong>{kit.name}</strong> · {kit.label} ·{" "}
                {formatBRL(kit.unitPriceCents)}
              </p>
              <button
                type="button"
                className="text-link"
                onClick={() => add(kit, 1)}
              >
                Adicionar {kit.name}
              </button>
            </div>
          )
        );
      })}
      <ul className="purchase-trust">
        <li>Frete calculado pelo CEP, antes de pagar.</li>
        <li>
          {cart.rules.pixDiscountPercent > 0
            ? `Pix com ${cart.rules.pixDiscountPercent}% de desconto nos cafés, ou cartão de crédito.`
            : "Pix ou cartão de crédito."}{" "}
          Pagamento processado pelo Asaas.
        </li>
        <li>O preço e o estoque são conferidos de novo ao finalizar.</li>
      </ul>
    </aside>
  );
}
