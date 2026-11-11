import Link from "next/link";
import {
  ActionForm,
  AdminShell,
  brl,
  FINANCIAL,
  LOGISTICS,
  when,
} from "../../../../components/admin/shell";
import { adminState } from "../../../../lib/commerce/server/admin";
import { shipmentOf } from "../../../../lib/commerce/server/labels";
import type { OrderRow } from "../../../../lib/commerce/server/orders";
import { runtime } from "../../../../lib/commerce/server/runtime";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export default async function AdminOrder({ params, searchParams }: Props) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const signedIn = (await adminState()).kind === "ok";
  const back = `/admin/pedidos/${id}/`;
  if (!signedIn || !UUID.test(id))
    return (
      <AdminShell current="/admin/pedidos/" title="Pedido" search={search}>
        {signedIn && <p className="admin-note">Pedido não encontrado.</p>}
      </AdminShell>
    );
  const { deps, config } = await runtime();
  const order = (
    await deps.db.query<OrderRow>("SELECT * FROM orders WHERE id = $1", [id])
  )[0];
  if (!order)
    return (
      <AdminShell current="/admin/pedidos/" title="Pedido" search={search}>
        <p className="admin-note">Pedido não encontrado.</p>
      </AdminShell>
    );
  const [events, payments, shipment] = await Promise.all([
    deps.db.query<{ type: string; data: object; created_at: string }>(
      "SELECT type, data, created_at FROM order_events WHERE order_id = $1 ORDER BY id",
      [id],
    ),
    deps.db.query<{
      provider_payment_id: string;
      status: string;
      method: string;
      amount_cents: number;
    }>(
      "SELECT provider_payment_id, status, method, amount_cents FROM payments WHERE order_id = $1 ORDER BY created_at",
      [id],
    ),
    shipmentOf(deps.db, id),
  ]);
  const paid = order.status === "paid";
  const flags = events.filter((event) =>
    ["payment.paid_without_stock", "payment.amount_mismatch"].includes(
      event.type,
    ),
  );
  return (
    <AdminShell
      current="/admin/pedidos/"
      title={`Pedido ${order.id.slice(0, 8).toUpperCase()}`}
      search={search}
    >
      <p>
        <Link href="/admin/pedidos/" className="text-link">
          ← Pedidos
        </Link>
      </p>
      {flags.length > 0 && (
        <p role="alert" className="cart-warning">
          Atenção:{" "}
          {flags
            .map((flag) =>
              flag.type === "payment.paid_without_stock"
                ? "pago depois de expirar e sem estoque para repor (repor estoque ou reembolsar no Asaas)"
                : "valor pago diferente do total do pedido (conferir no Asaas)",
            )
            .join("; ")}
          .
        </p>
      )}
      <dl className="admin-kpis">
        <div>
          <dt>Pagamento</dt>
          <dd>
            {FINANCIAL[order.status]} ·{" "}
            {order.payment_method === "pix" ? "Pix" : "Cartão"}
          </dd>
        </div>
        <div>
          <dt>Logística</dt>
          <dd>{LOGISTICS[order.fulfillment_status]}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{brl(order.total_cents)}</dd>
        </div>
        <div>
          <dt>Criado · pago</dt>
          <dd>
            {when(order.created_at)} · {when(order.paid_at)}
          </dd>
        </div>
      </dl>
      <section aria-labelledby="order-items">
        <h2 id="order-items">Itens (preços do momento da compra)</h2>
        <ul className="admin-list">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.quantity}× {item.name} · {item.label} ·{" "}
              {brl(item.unitPriceCents)} = {brl(item.lineTotalCents)}
            </li>
          ))}
        </ul>
        <p className="admin-note">
          Subtotal {brl(order.subtotal_cents)} · desconto Pix −
          {brl(order.discount_cents)} · frete {brl(order.shipping_cents)} (
          {order.shipping.company} {order.shipping.name}, cotado{" "}
          {brl(order.shipping.quotedCents ?? order.shipping_cents)}) · total{" "}
          {brl(order.total_cents)}
        </p>
      </section>
      <section aria-labelledby="order-delivery">
        <h2 id="order-delivery">Entrega</h2>
        <p>
          {order.customer.name} · {order.customer.phone} ·{" "}
          {order.customer.email}
          <br />
          {order.address.street}, {order.address.number}
          {order.address.complement && ` · ${order.address.complement}`} ·{" "}
          {order.address.district} · {order.address.city}/{order.address.state}{" "}
          · CEP {order.address.cep}
        </p>
        <ul className="admin-list">
          {order.volumes.map((volume, index) => (
            <li key={index}>
              Volume {index + 1}: {volume.box.label} · {volume.heightCm}×
              {volume.widthCm}×{volume.lengthCm} cm ·{" "}
              {(volume.weightGrams / 1000).toLocaleString("pt-BR")} kg ·{" "}
              {volume.items
                .map((item) => `${item.quantity}× ${item.sku}`)
                .join(", ")}
            </li>
          ))}
        </ul>
        {order.tracking_code && (
          <p>
            Rastreio: <strong>{order.tracking_code}</strong>
            {order.tracking_carrier && ` · ${order.tracking_carrier}`}
          </p>
        )}
      </section>
      {paid && order.fulfillment_status !== "delivered" && (
        <section aria-labelledby="order-actions" className="admin-actions">
          <h2 id="order-actions">Ações</h2>
          {order.fulfillment_status === "unfulfilled" && (
            <ActionForm
              action="order.prepare"
              back={back}
              label="Marcar em preparação"
              fields={{ orderId: id }}
            />
          )}
          {["unfulfilled", "preparing"].includes(order.fulfillment_status) && (
            <>
              {shipment?.status !== "generated" && (
                <ActionForm
                  action="order.label"
                  back={back}
                  label={
                    shipment
                      ? "Retomar etiqueta (não compra de novo)"
                      : "Comprar etiqueta no Melhor Envio"
                  }
                  fields={{ orderId: id }}
                >
                  <>
                    <label htmlFor="invoiceKey">
                      Chave da NF-e (44 números)
                      {config.melhorEnvio.nonCommercial &&
                        " · opcional: sem ela, declaração de conteúdo"}
                    </label>
                    <input
                      id="invoiceKey"
                      name="invoiceKey"
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </>
                </ActionForm>
              )}
              <ActionForm
                action="order.ship"
                back={back}
                label="Marcar como enviado (rastreio manual)"
                fields={{ orderId: id }}
                secondary
              >
                <label htmlFor="tracking">Código de rastreio</label>
                <input id="tracking" name="tracking" required />
                <label htmlFor="carrier">Transportadora</label>
                <input
                  id="carrier"
                  name="carrier"
                  defaultValue={order.shipping.company}
                />
              </ActionForm>
            </>
          )}
          {order.fulfillment_status === "shipped" && (
            <ActionForm
              action="order.deliver"
              back={back}
              label="Marcar como entregue"
              fields={{ orderId: id }}
            />
          )}
        </section>
      )}
      {shipment && (
        <section aria-labelledby="order-label">
          <h2 id="order-label">Etiqueta</h2>
          <p>
            Etapa: {shipment.status} · volumes: {shipment.provider_ids.length} ·
            custo:{" "}
            {shipment.cost_cents !== null ? brl(shipment.cost_cents) : "—"}
            {shipment.error && ` · último erro: ${shipment.error}`}
          </p>
          {shipment.label_url && (
            <p>
              <a href={shipment.label_url} className="text-link">
                Imprimir etiqueta(s)
              </a>
            </p>
          )}
          {shipment.status === "generated" && (
            <ActionForm
              action="order.tracking"
              back={back}
              label="Atualizar rastreio"
              fields={{ orderId: id }}
              secondary
            />
          )}
        </section>
      )}
      <section aria-labelledby="order-payments">
        <h2 id="order-payments">Cobranças (Asaas)</h2>
        <ul className="admin-list">
          {payments.map((payment) => (
            <li key={payment.provider_payment_id} className="mono">
              {payment.provider_payment_id} · {payment.status} ·{" "}
              {brl(payment.amount_cents)}
            </li>
          ))}
          {!payments.length && <li>Nenhuma cobrança criada.</li>}
        </ul>
      </section>
      <section aria-labelledby="order-history">
        <h2 id="order-history">Histórico</h2>
        <ol className="admin-list">
          {events.map((event, index) => (
            <li key={index}>
              <span className="mono">{when(event.created_at)}</span>{" "}
              {event.type}
            </li>
          ))}
        </ol>
      </section>
    </AdminShell>
  );
}
