"use client";
import { Arrow } from "./arrow";
import Link from "next/link";
import { useSelection } from "./selection-provider";
import type { CatalogEntry } from "../lib/catalog-model";
export function CartSelection({ entries }: { entries: CatalogEntry[] }) {
  const { ids, remove, message } = useSelection();
  const items = entries.flatMap((entry) =>
    entry.offers
      .filter((offer) => ids.includes(offer.id))
      .map((offer) => ({
        offer,
        coffee: entry.coffee,
        lot: entry.lots.find((lot) => lot.id === offer.lotId)!,
      })),
  );
  return items.length ? (
    <section className="cart-review">
      <p className="eyebrow">SELEÇÃO DEMONSTRATIVA · SEM PEDIDO</p>
      <h1>
        Sua escolha,
        <br />
        <em>em construção.</em>
      </h1>
      <p className="editorial-lead">
        Esta lista serve apenas para revisar ofertas editoriais. Não consulta
        estoque, reserva produtos, calcula frete ou recebe pagamentos.
      </p>
      <ul>
        {items.map(({ offer, coffee, lot }) => (
          <li key={offer.id}>
            <div>
              <p className="eyebrow">
                {lot.code} · SKU {offer.sku}
              </p>
              <h2>{coffee.name}</h2>
              <p>
                {offer.weightInGrams === null
                  ? "Peso a confirmar"
                  : `${offer.weightInGrams} g`}{" "}
                · {offer.grind ?? "Moagem a confirmar"}
              </p>
              <p>
                {offer.unitPriceInCents === null
                  ? "Preço a confirmar"
                  : `Preço editorial: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: offer.currency }).format(offer.unitPriceInCents / 100)}`}
              </p>
              <Link
                className="text-link"
                href={`/cafes/${coffee.slug}/?lote=${lot.id}`}
              >
                Voltar ao café
              </Link>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() => remove(offer.id)}
              aria-label={`Remover oferta ${offer.sku}`}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      <p role="status">{message}</p>
      <p className="status-pill">
        Pedidos, reserva, pagamento e checkout indisponíveis
      </p>
      <Link className="button" href="/cafes/">
        Continuar explorando <Arrow />
      </Link>
    </section>
  ) : (
    <section className="empty-state">
      <p className="eyebrow">DA ESCOLHA AO ENCONTRO</p>
      <h1>
        Carrinho.
        <br />
        <em>Em breve.</em>
      </h1>
      <p>
        A compra online ainda não está disponível. Por enquanto, conheça os
        cafés e os perfis da nossa curadoria.
      </p>
      <p>Não recebemos pedidos, reservas ou pagamentos por este site.</p>
      <p>
        Quando houver ofertas reais publicadas, você poderá reuni-las numa
        seleção demonstrativa, sem compromisso comercial.
      </p>
      <Link className="button" href="/cafes/">
        Explorar os cafés <Arrow />
      </Link>
    </section>
  );
}
