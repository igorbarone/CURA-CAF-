import { Arrow } from "../../components/arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { commerce } from "../../lib/commerce";
export const metadata: Metadata = { title: "Carrinho — Em breve | Cura Café" };
export default function CartPage() {
  return (
    <>
      <Header />
      <main id="conteudo" className="wrap cart-page">
        <Breadcrumbs current="Carrinho" />
        <section className="empty-state" data-commerce-status={commerce.status}>
          <p className="eyebrow">DA ESCOLHA AO ENCONTRO</p>
          <h1>
            Carrinho.
            <br />
            <em>Em breve.</em>
          </h1>
          <p>
            A compra online ainda não está disponível. Por enquanto, conheça os
            cafés e os perfis da nossa curadoria.
          </p>
          <p>Não recebemos pedidos, reservas ou pagamentos por este site.</p>
          <Link className="button" href="/cafes/">
            Explorar os cafés{" "}
            <span aria-hidden="true">
              <Arrow />
            </span>
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
