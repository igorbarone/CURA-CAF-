"use client";
import { Arrow } from "./arrow";
import { useSelection } from "./selection-provider";
import Link from "next/link";
import type { Offer } from "../lib/content-schema";
import type { ContactLink } from "../lib/contact";
import { ContactLinks } from "./contact-links";
export function CommerceStatus({
  offers = [],
  contact = [],
}: {
  offers?: Offer[];
  contact?: ContactLink[];
}) {
  const { add, message } = useSelection();
  return (
    <aside className="commerce-status" aria-label="Informações comerciais">
      <p className="eyebrow">UMA ESCOLHA COM TRANSPARÊNCIA</p>
      {offers.length ? (
        <>
          <p>
            Dados editoriais das ofertas. A compra e a disponibilidade em tempo
            real dependem de integração comercial.
          </p>
          <ul className="offer-list">
            {offers.map((offer) => (
              <li key={offer.id}>
                <p className="mono">SKU {offer.sku}</p>
                <dl>
                  <div>
                    <dt>Preço de referência</dt>
                    <dd>
                      {offer.unitPriceInCents === null
                        ? "A confirmar"
                        : new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: offer.currency,
                          }).format(offer.unitPriceInCents / 100)}
                    </dd>
                  </div>
                  <div>
                    <dt>Peso</dt>
                    <dd>
                      {offer.weightInGrams === null
                        ? "A confirmar"
                        : `${offer.weightInGrams} g`}
                    </dd>
                  </div>
                  <div>
                    <dt>Moagem</dt>
                    <dd>{offer.grind ?? "A confirmar"}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="offer-select"
                  onClick={() => add(offer.id)}
                >
                  Selecionar oferta · demonstração
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          Preço, estoque, peso e opções de moagem ainda não foram confirmados.
        </p>
      )}
      {offers.length > 0 && (
        <>
          <p role="status" className="selection-feedback">
            {message}
          </p>
          <Link className="text-link" href="/carrinho/">
            Revisar seleção demonstrativa <Arrow />
          </Link>
        </>
      )}
      {contact.length > 0 && (
        <div className="commerce-contact">
          <p className="commerce-contact-title">
            Quer conhecer este café? Fale com a Cura.
          </p>
          <ContactLinks
            links={contact}
            note="Tire dúvidas sobre o café. A conversa não cria pedido, reserva ou cobrança."
          />
        </div>
      )}
      <button type="button" disabled>
        Compra online · Em breve
      </button>
      <p className="availability">
        Sem venda online, reserva ou cobrança nesta fase.
      </p>
    </aside>
  );
}
