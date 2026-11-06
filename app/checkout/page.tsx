import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "../../components/editorial-shell";
import { CheckoutForm } from "../../components/commerce/checkout-form";
import { commerceEnabled } from "../../lib/commerce/client";
export const metadata: Metadata = {
  title: "Finalizar compra | Cura Café",
  robots: { index: false, follow: false },
};
export default function CheckoutPage() {
  return (
    <EditorialShell current="Finalizar compra">
      {commerceEnabled ? (
        <CheckoutForm />
      ) : (
        <section className="empty-state">
          <p className="eyebrow">CHECKOUT</p>
          <h1>Compra online em breve.</h1>
          <p>
            Este site ainda não vende online. Nenhum pedido ou pagamento é feito
            aqui.
          </p>
          <Link className="button" href="/cafes/">
            Ver os cafés
          </Link>
        </section>
      )}
    </EditorialShell>
  );
}
