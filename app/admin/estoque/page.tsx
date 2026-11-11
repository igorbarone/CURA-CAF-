import { ActionForm, AdminShell, when } from "../../../components/admin/shell";
import { buildPriceBook } from "../../../lib/commerce/catalog";
import { adminState } from "../../../lib/commerce/server/admin";
import { runtime } from "../../../lib/commerce/server/runtime";
import { stockReport } from "../../../lib/commerce/server/stock";
import { loadContent } from "../../../lib/content-loader";

export const dynamic = "force-dynamic";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export default async function AdminStock({ searchParams }: Props) {
  const search = await searchParams;
  const signedIn = (await adminState()).kind === "ok";
  if (!signedIn)
    return (
      <AdminShell current="/admin/estoque/" title="Estoque" search={search}>
        {null}
      </AdminShell>
    );
  const { deps } = await runtime();
  const content = loadContent();
  const [rows, history] = await Promise.all([
    stockReport(deps.db, content, buildPriceBook(content)),
    deps.db.query<{
      sku: string;
      delta: number;
      available_after: number;
      reason: string;
      actor: string;
      created_at: string;
    }>(
      "SELECT sku, delta, available_after, reason, actor, created_at FROM inventory_adjustments ORDER BY id DESC LIMIT 30",
    ),
  ]);
  return (
    <AdminShell current="/admin/estoque/" title="Estoque" search={search}>
      <p className="admin-note">
        Disponível = o que ainda pode ser vendido. Reservado = em pedidos
        aguardando pagamento (volta sozinho se o prazo vencer). Todo ajuste
        exige motivo e fica registrado.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Variante</th>
              <th scope="col">Venda online</th>
              <th scope="col">Disponível</th>
              <th scope="col">Reservado</th>
              <th scope="col">Vendido</th>
              <th scope="col">Ajustar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.sku}>
                <td>
                  <strong>{row.coffee}</strong> · {row.label}
                  <br />
                  <span className="mono">
                    {row.sku} · lote {row.lot}
                  </span>
                </td>
                <td>
                  {row.sellable
                    ? row.paused
                      ? "Pausada"
                      : row.available === 0
                        ? "Esgotada"
                        : "Ativa"
                    : `Bloqueada: ${row.issues.join(", ")}`}
                </td>
                <td>{row.available ?? "sem registro"}</td>
                <td>{row.held}</td>
                <td>{row.sold}</td>
                <td>
                  <ActionForm
                    action="stock.set"
                    back="/admin/estoque/"
                    label="Salvar"
                    fields={{ sku: row.sku }}
                    secondary
                  >
                    <label
                      htmlFor={`qty-${row.sku}`}
                      className="visually-hidden"
                    >
                      Novo disponível de {row.sku}
                    </label>
                    <input
                      id={`qty-${row.sku}`}
                      name="quantity"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={row.available ?? 0}
                      required
                    />
                    <label
                      htmlFor={`reason-${row.sku}`}
                      className="visually-hidden"
                    >
                      Motivo do ajuste de {row.sku}
                    </label>
                    <input
                      id={`reason-${row.sku}`}
                      name="reason"
                      placeholder="Motivo (ex.: lote torrado)"
                      required
                    />
                  </ActionForm>
                  <ActionForm
                    action={row.paused ? "stock.resume" : "stock.pause"}
                    back="/admin/estoque/"
                    label={row.paused ? "Retomar venda" : "Pausar venda"}
                    fields={{ sku: row.sku }}
                    secondary
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-labelledby="stock-history">
        <h2 id="stock-history">Últimos ajustes</h2>
        <ol className="admin-list">
          {history.map((item, index) => (
            <li key={index}>
              <span className="mono">{when(item.created_at)}</span> {item.sku}{" "}
              {item.delta >= 0 ? `+${item.delta}` : item.delta} →{" "}
              {item.available_after} · {item.reason} ({item.actor})
            </li>
          ))}
          {!history.length && <li>Nenhum ajuste registrado.</li>}
        </ol>
      </section>
    </AdminShell>
  );
}
