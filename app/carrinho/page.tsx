import type { Metadata } from "next";
import { EditorialShell } from "../../components/editorial-shell";
import { CartSelection } from "../../components/cart-selection";
import { getCatalog } from "../../lib/coffees";
export const metadata: Metadata = {
  title: "Carrinho — Em breve | Cura Café",
  robots: { index: false, follow: true },
};
export default function CartPage() {
  return (
    <EditorialShell current="Carrinho">
      <CartSelection entries={getCatalog()} />
    </EditorialShell>
  );
}
