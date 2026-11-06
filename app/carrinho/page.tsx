import type { Metadata } from "next";
import { EditorialShell } from "../../components/editorial-shell";
import { CartSelection } from "../../components/cart-selection";
import { getCatalog } from "../../lib/coffees";
import { CartView } from "../../components/commerce/cart-view";
import { commerceEnabled } from "../../lib/commerce/client";
export const metadata: Metadata = {
  title: commerceEnabled
    ? "Carrinho | Cura Café"
    : "Carrinho — Em breve | Cura Café",
  robots: { index: false, follow: true },
};
export default function CartPage() {
  return (
    <EditorialShell current="Carrinho">
      {commerceEnabled ? (
        <CartView />
      ) : (
        <CartSelection entries={getCatalog()} />
      )}
    </EditorialShell>
  );
}
