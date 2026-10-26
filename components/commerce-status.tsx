import type { Offer } from "../lib/content-schema";
export function CommerceStatus({ offers = [] }: { offers?: Offer[] }) {
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
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          Preço, estoque, peso e opções de moagem ainda não foram confirmados.
        </p>
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
