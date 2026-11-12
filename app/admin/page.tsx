import Link from "next/link";
import {
  ActionForm,
  AdminShell,
  brl,
  FINANCIAL,
} from "../../components/admin/shell";
import { adminState } from "../../lib/commerce/server/admin";
import { readConfig } from "../../lib/commerce/server/config";
import { indicators } from "../../lib/commerce/server/indicators";
import { runtime } from "../../lib/commerce/server/runtime";

export const dynamic = "force-dynamic";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const PERIODS = [
  { days: "7", label: "7 dias" },
  { days: "30", label: "30 dias" },
  { days: "todos", label: "Desde o início" },
];
export default async function AdminHome({ searchParams }: Props) {
  const search = await searchParams;
  const period = typeof search.dias === "string" ? search.dias : "30";
  const signedIn = (await adminState()).kind === "ok";
  const data = signedIn
    ? await (async () => {
        const { deps } = await runtime();
        return indicators(deps.db, deps.rules, {
          days: period === "todos" ? null : Number(period) || 30,
        });
      })()
    : null;
  const config = readConfig();
  return (
    <AdminShell current="/admin/" title="Visão geral" search={search}>
      {data && (
        <>
          <p className="admin-note">
            Ambiente de pagamento: <strong>{config.environment}</strong>
            {config.environment === "sandbox" && " (nenhuma cobrança real)"}
            {" · "}Pix e cartão: {config.payments ? "ativos" : "desligados"}
            {" · "}frete: {config.shipping ? "ativo" : "desligado"}
            {" · "}etiquetas: {config.labels ? "ativas" : "desligadas"}
          </p>
          <nav aria-label="Período" className="admin-tabs">
            {PERIODS.map((item) => (
              <Link
                key={item.days}
                href={`/admin/?dias=${item.days}`}
                aria-current={item.days === period ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <dl className="admin-kpis">
            <div>
              <dt>Pedidos pagos</dt>
              <dd>
                {data.paidOrders}{" "}
                <small>
                  ({data.pixOrders} Pix · {data.cardOrders} cartão)
                </small>
              </dd>
            </div>
            <div>
              <dt>Faturamento bruto</dt>
              <dd>{brl(data.grossCents)}</dd>
            </div>
            <div>
              <dt>Descontos Pix</dt>
              <dd>{brl(data.pixDiscountCents)}</dd>
            </div>
            <div>
              <dt>Frete cobrado</dt>
              <dd>{brl(data.shippingChargedCents)}</dd>
            </div>
            <div>
              <dt>Taxas estimadas de cartão</dt>
              <dd>
                {brl(data.estimatedCardFeesCents)}{" "}
                <small>estimativa interna, não cobrada do cliente</small>
              </dd>
            </div>
            <div>
              <dt>Taxas estimadas de Pix</dt>
              <dd>
                {brl(data.estimatedPixFeesCents)}{" "}
                <small>taxa fixa por venda, estimativa interna</small>
              </dd>
            </div>
            <div>
              <dt>Ticket médio</dt>
              <dd>{brl(data.averageTicketCents)}</dd>
            </div>
          </dl>
          <section aria-labelledby="admin-todo">
            <h2 id="admin-todo">Para fazer</h2>
            <ul className="admin-list">
              <li>
                <Link href="/admin/pedidos/?filtro=enviar">
                  {data.toShip} pedido(s) pago(s) aguardando envio
                </Link>
              </li>
              {data.needsAttention > 0 && (
                <li>
                  <Link href="/admin/pedidos/?filtro=atencao">
                    {data.needsAttention} pedido(s) pedem atenção (pago sem
                    estoque ou valor divergente)
                  </Link>
                </li>
              )}
            </ul>
            <p className="admin-note">
              Pedidos por status no período:{" "}
              {Object.entries(data.byStatus)
                .map(([key, count]) => `${FINANCIAL[key] ?? key}: ${count}`)
                .join(" · ") || "nenhum"}
            </p>
            <ActionForm
              action="orders.reconcile"
              back="/admin/"
              label="Revisar cobranças pendentes agora"
              secondary
            />
          </section>
        </>
      )}
    </AdminShell>
  );
}
