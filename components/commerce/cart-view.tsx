"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatBRL, pricePer100g } from "../../lib/commerce/catalog";
import { crossSell } from "../../lib/commerce/recommendations";
import { api, messageFor, type ApiError } from "../../lib/commerce/client";
import { centsToValue, track } from "../../lib/analytics";
import { Arrow } from "../arrow";
import { useCart } from "./cart-provider";
import { QuantityInput } from "./quantity-input";
import { PackThumb } from "./pack-thumb";
import { useAvailability } from "./use-availability";
import { cepDigits, maskCep } from "../../lib/commerce/format";
export type Quote = {
  subtotalCents: number;
  freeShipping: boolean;
  options: {
    id: string;
    name: string;
    company: string;
    priceCents: number;
    chargedCents: number;
    days: number | null;
  }[];
};
export const CEP_KEY = "cura-checkout-cep";
export function CartView() {
  const cart = useCart();
  const { units } = useAvailability(cart.lines.map((line) => line.id));
  const [cep, setCep] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);
  // Only the latest freight request may update the screen.
  const quoteRequest = useRef(0);
  useEffect(() => {
    try {
      setCep(sessionStorage.getItem(CEP_KEY) ?? "");
    } catch {
      /* optional */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (cart.ready && cart.lines.length)
      track("view_cart", {
        value: centsToValue(cart.subtotalCents),
        items: cart.lines.map((line) => ({
          item_id: line.id,
          item_name: line.item.name,
          item_variant: line.item.label,
          price: centsToValue(line.item.unitPriceCents),
          quantity: line.quantity,
        })),
      });
    // Once when the cart is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);
  // A different cart invalidates the quote; with a known CEP it is quoted
  // again right away, so the total never shows stale freight.
  useEffect(() => {
    quoteRequest.current += 1;
    setQuote(null);
    setLoading(false);
    if (
      restored &&
      cart.ready &&
      cart.lines.length &&
      cepDigits(cep).length === 8
    )
      quoteFor(cep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, cart.ready, cart.subtotalCents, cart.weightGrams]);
  if (!cart.ready) return <p className="body-copy">Carregando o carrinho…</p>;
  if (!cart.lines.length)
    return (
      <section className="empty-state">
        <p className="eyebrow">CARRINHO</p>
        <h1>Seu carrinho está vazio.</h1>
        <p>
          Conheça os cafés da curadoria e escolha a embalagem que faz sentido
          para você.
        </p>
        <Link className="button" href="/cafes/">
          Ver os cafés <Arrow />
        </Link>
      </section>
    );
  const short = cart.lines.filter(
    (line) => units && (units[line.id] ?? 0) < line.quantity,
  );
  const suggestions = crossSell(
    cart.book,
    cart.lines.map((line) => line.item.coffeeSlug),
    cart.lines.map((line) => line.id),
  ).slice(0, 2);
  async function estimate(event: React.FormEvent) {
    event.preventDefault();
    await quoteFor(cep);
  }
  async function quoteFor(value: string) {
    const request = ++quoteRequest.current;
    setLoading(true);
    setQuoteError("");
    const result = await api<Quote>("/api/shipping/quote/", {
      method: "POST",
      body: JSON.stringify({
        cep: value,
        lines: cart.lines.map(({ id, quantity }) => ({ id, quantity })),
      }),
    });
    if (request !== quoteRequest.current) return;
    setLoading(false);
    if (result.ok) {
      setQuote(result.data);
      try {
        sessionStorage.setItem(CEP_KEY, value);
      } catch {
        /* optional */
      }
    } else setQuoteError(messageFor(result.error as ApiError));
  }
  const cheapest = quote?.options[0];
  return (
    <section className="cart-page-view" aria-labelledby="cart-title">
      <p className="eyebrow">SEU CARRINHO</p>
      <h1 id="cart-title">
        Sua escolha,
        <br />
        <em>pronta para a xícara.</em>
      </h1>
      <ul className="cart-lines">
        {cart.lines.map((line) => {
          const stock = units ? (units[line.id] ?? 0) : null;
          return (
            <li key={line.id}>
              <div className="cart-line-main">
                <PackThumb item={line.item} size={72} />
                <div>
                  <h2>{line.item.name}</h2>
                  <p>{line.item.label}</p>
                  <p className="mono">
                    {formatBRL(line.item.unitPriceCents)} cada ·{" "}
                    {formatBRL(pricePer100g(line.item))} / 100 g
                  </p>
                  {stock !== null && stock < line.quantity && (
                    <p className="cart-warning" role="alert">
                      {stock === 0
                        ? "Indisponível no momento. Remova o item para continuar."
                        : `Só há ${stock} unidade(s) disponível(is). Ajuste a quantidade.`}
                    </p>
                  )}
                </div>
              </div>
              <QuantityInput
                id={`qty-${line.id}`}
                label={`Quantidade de ${line.item.name} ${line.item.label}`}
                value={line.quantity}
                max={cart.rules.maxQuantityPerLine}
                onChange={(value) => cart.setQuantity(line.id, value)}
                hideLabel
              />
              <p className="cart-line-total">
                {formatBRL(line.lineTotalCents)}
              </p>
              <button
                type="button"
                className="text-link"
                onClick={() => cart.remove(line.id)}
                aria-label={`Remover ${line.item.name} ${line.item.label}`}
              >
                Remover
              </button>
            </li>
          );
        })}
      </ul>
      <div className="cart-summary">
        <form onSubmit={estimate} className="cep-form">
          <label htmlFor="cart-cep">Calcular frete</label>
          <div>
            <input
              id="cart-cep"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={cep}
              onChange={(event) => setCep(maskCep(event.target.value))}
            />
            <button type="submit" className="text-link" disabled={loading}>
              {loading ? "Calculando…" : "Calcular"}
            </button>
          </div>
          <p role="status" className="cart-warning">
            {quoteError}
          </p>
          {quote && (
            <ul className="shipping-estimate">
              {quote.options.map((option) => (
                <li key={option.id}>
                  {option.company} {option.name}
                  {option.days !== null &&
                    ` · até ${option.days} dias úteis`}:{" "}
                  <strong>
                    {option.chargedCents === 0
                      ? "grátis"
                      : formatBRL(option.chargedCents)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </form>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatBRL(cart.subtotalCents)}</dd>
          </div>
          <div>
            <dt>Frete</dt>
            <dd>
              {cheapest
                ? `a partir de ${cheapest.chargedCents === 0 ? "grátis" : formatBRL(cheapest.chargedCents)}`
                : "calculado pelo CEP"}
            </dd>
          </div>
          <div className="cart-total">
            <dt>Total</dt>
            <dd>
              {formatBRL(cart.subtotalCents + (cheapest?.chargedCents ?? 0))}
              {!cheapest && <small> + frete</small>}
            </dd>
          </div>
        </dl>
        {cart.rules.freeShippingFromCents !== null && !cart.freeShipping && (
          <p className="availability">
            Frete grátis a partir de{" "}
            {formatBRL(cart.rules.freeShippingFromCents)} em produtos.
          </p>
        )}
        {short.length > 0 ? (
          <p className="cart-warning">
            Ajuste os itens indisponíveis para finalizar.
          </p>
        ) : (
          <Link className="button cart-checkout" href="/checkout/">
            Finalizar compra <Arrow />
          </Link>
        )}
        <Link className="text-link" href="/cafes/">
          Continuar escolhendo
        </Link>
      </div>
      {suggestions.length > 0 && (
        <aside className="cart-suggestions" aria-label="Sugestões">
          <p className="eyebrow">PARA COMPLETAR</p>
          <ul>
            {suggestions.map(({ item, reason }) => (
              <li key={item.id}>
                <PackThumb item={item} size={48} />
                <p>
                  <strong>{item.name}</strong> · {item.label} ·{" "}
                  {formatBRL(item.unitPriceCents)}
                </p>
                <p className="availability">{reason}</p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => cart.add(item.id)}
                >
                  Adicionar {item.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </section>
  );
}
