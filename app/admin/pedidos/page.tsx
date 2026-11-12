import Link from "next/link";
import {
  AdminShell,
  brl,
  FINANCIAL,
  LOGISTICS,
  when,
} from "../../../components/admin/shell";
import { adminState } from "../../../lib/commerce/server/admin";
import { runtime } from "../../../lib/commerce/server/runtime";

export const dynamic = "force-dynamic";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const FILTERS: Record<string, { label: string; where: string }> = {
  todos: { label: "Todos", where: "true" },
  pagamento: {
    label: "Aguardando pagamento",
    where: "status = 'pending_payment'",
  },
  enviar: {
    label: "Pagos a enviar",
    where:
      "status = 'paid' AND fulfillment_status IN ('unfulfilled', 'preparing')",
  },
  enviados: {
    label: "Enviados",
    where: "fulfillment_status IN ('shipped', 'delivered')",
  },
  encerrados: {
    label: "Expirados ou cancelados",
    where: "status IN ('expired', 'cancelled', 'payment_failed', 'refunded')",
  },
  atencao: {
    label: "Pedem atenção",
    where:
      "id IN (SELECT order_id FROM order_events WHERE type IN ('payment.paid_without_stock', 'payment.amount_mismatch'))",
  },
};
export default async function AdminOrders({ searchParams }: Props) {
  const search = await searchParams;
  const filter =
    typeof search.filtro === "string" && FILTERS[search.filtro]
      ? search.filtro
      : "todos";
  const signedIn = (await adminState()).kind === "ok";
  const orders = signedIn
    ? await (
        await runtime()
      ).deps.db.query<{
        id: string;
        status: string;
        fulfillment_status: string;
        payment_method: string;
        total_cents: number;
        uf: string;
        first_name: string;
        created_at: string;
      }>(
        `SELECT id, status, fulfillment_status, payment_method, total_cents,
           address->>'state' AS uf, split_part(customer->>'name', ' ', 1) AS first_name, created_at
         FROM orders WHERE ${FILTERS[filter].where} ORDER BY created_at DESC LIMIT 100`,
      )
    : [];
  return (
    <AdminShell current="/admin/pedidos/" title="Pedidos" search={search}>
      <nav aria-label="Filtros" className="admin-tabs">
        {Object.entries(FILTERS).map(([key, item]) => (
          <Link
            key={key}
            href={`/admin/pedidos/?filtro=${key}`}
            aria-current={key === filter ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="admin-note">Nenhum pedido neste filtro.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Pedido</th>
                <th scope="col">Data</th>
                <th scope="col">Cliente</th>
                <th scope="col">Pagamento</th>
                <th scope="col">Logística</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/pedidos/${order.id}/`} className="mono">
                      {order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td>{when(order.created_at)}</td>
                  <td>
                    {order.first_name} · {order.uf}
                  </td>
                  <td>
                    {FINANCIAL[order.status] ?? order.status} ·{" "}
                    {order.payment_method === "pix" ? "Pix" : "Cartão"}
                  </td>
                  <td>{LOGISTICS[order.fulfillment_status]}</td>
                  <td>{brl(order.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
