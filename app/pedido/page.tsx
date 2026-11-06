import type { Metadata } from "next";
import { EditorialShell } from "../../components/editorial-shell";
import { OrderStatus } from "../../components/commerce/order-status";
import { commerceEnabled } from "../../lib/commerce/client";
export const metadata: Metadata = {
  title: "Seu pedido | Cura Café",
  robots: { index: false, follow: false },
};
export default function OrderPage() {
  return (
    <EditorialShell current="Seu pedido">
      {commerceEnabled ? (
        <OrderStatus />
      ) : (
        <section className="empty-state">
          <h1>Compra online em breve.</h1>
          <p>Não há pedidos neste site.</p>
        </section>
      )}
    </EditorialShell>
  );
}
