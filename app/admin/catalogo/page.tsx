import { AdminShell, brl } from "../../../components/admin/shell";
import {
  buildPriceBook,
  sellabilityIssues,
} from "../../../lib/commerce/catalog";
import { adminState } from "../../../lib/commerce/server/admin";
import { loadContent } from "../../../lib/content-loader";

export const dynamic = "force-dynamic";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const STATUS: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};
// Catalog view: what is published and what still blocks the sale. Editing
// happens in Pages CMS (Git), so every change is reviewed, versioned and
// validated by the build before it reaches the site.
export default async function AdminCatalog({ searchParams }: Props) {
  const search = await searchParams;
  const signedIn = (await adminState()).kind === "ok";
  const content = loadContent();
  const book = buildPriceBook(content);
  return (
    <AdminShell
      current="/admin/catalogo/"
      title="Produtos e lotes"
      search={search}
    >
      {signedIn && (
        <>
          <ol className="admin-flow" aria-label="Fluxo de publicação">
            <li>
              <strong>Rascunho</strong> no Pages CMS: pode ficar incompleto.
            </li>
            <li>
              <strong>Validação</strong>: a publicação (build) recusa dados
              inconsistentes e esta tela lista o que falta para vender.
            </li>
            <li>
              <strong>Publicação</strong>: estado “Publicado” no CMS; o site
              atualiza em alguns minutos.
            </li>
            <li>
              <strong>Disponibilidade</strong>: estoque, pausa e datas de venda,
              controlados aqui no painel.
            </li>
          </ol>
          <p>
            <a
              className="button"
              href="https://app.pagescms.org/"
              rel="noopener"
            >
              Editar cafés, lotes e variantes no Pages CMS
            </a>
          </p>
          {content.coffees.map((coffee) => {
            const lots = content.lots.filter(
              (lot) => lot.coffeeId === coffee.id,
            );
            return (
              <section key={coffee.id} className="admin-coffee">
                <h2>
                  {coffee.name}{" "}
                  <small>
                    {STATUS[coffee.status]} · /cafes/{coffee.slug}/
                  </small>
                </h2>
                {lots.map((lot) => (
                  <div key={lot.id}>
                    <h3>
                      Lote {lot.code}{" "}
                      <small>
                        {STATUS[lot.status]}
                        {lot.harvest && ` · safra ${lot.harvest}`}
                        {lot.score !== null &&
                          ` · ${lot.score} pontos${lot.scoreMethodology ? ` ${lot.scoreMethodology}` : ""}`}
                        {(lot.saleStartsAt || lot.saleEndsAt) &&
                          ` · venda ${lot.saleStartsAt ?? "…"} a ${lot.saleEndsAt ?? "…"}`}
                      </small>
                    </h3>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th scope="col">Variante</th>
                            <th scope="col">Estado</th>
                            <th scope="col">Preço</th>
                            <th scope="col">Venda online</th>
                          </tr>
                        </thead>
                        <tbody>
                          {content.offers
                            .filter((offer) => offer.lotId === lot.id)
                            .map((offer) => {
                              const issues = sellabilityIssues(content, offer);
                              return (
                                <tr key={offer.id}>
                                  <td>
                                    <span className="mono">{offer.sku}</span>
                                    <br />
                                    {offer.weightInGrams
                                      ? `${offer.weightInGrams} g`
                                      : "peso a confirmar"}{" "}
                                    · {offer.grind ?? "moagem a confirmar"}
                                  </td>
                                  <td>{STATUS[offer.status]}</td>
                                  <td>
                                    {offer.unitPriceInCents !== null
                                      ? brl(offer.unitPriceInCents)
                                      : "a confirmar"}
                                    {offer.promoPriceInCents !== null &&
                                      ` · promo ${brl(offer.promoPriceInCents)}`}
                                  </td>
                                  <td>
                                    {book[offer.id]
                                      ? "Liberada"
                                      : offer.status === "draft"
                                        ? "Rascunho (não vende)"
                                        : `Falta: ${issues.join(", ")}`}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </>
      )}
    </AdminShell>
  );
}
