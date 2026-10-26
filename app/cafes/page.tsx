import { getCatalog } from "../../lib/coffees";
import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Catalog } from "../../components/catalog";
export const metadata: Metadata = {
  title: "Nossos cafés | Cura Café",
  description:
    "Encontre seu café por perfil sensorial. Cafés brasileiros, escolhidos com critério e explicados sem complicação.",
};
export default function CoffeesPage() {
  return (
    <>
      <Header />
      <main className="wrap catalog-page" id="conteudo">
        <Breadcrumbs current="Cafés" />
        <div className="section-heading">
          <div>
            <p className="eyebrow">ENCONTRADO. ESCOLHIDO. EXPLICADO.</p>
            <h1>
              Nossos cafés.
              <br />
              <em>A sua escolha.</em>
            </h1>
          </div>
          <p className="section-intro">
            Explore a seleção, conheça quem produz e descubra o perfil que
            conversa com você.
          </p>
        </div>
        <Catalog entries={getCatalog()} />
        <p className="catalog-note mono">
          Preço e disponibilidade a confirmar. Sem venda online nesta fase.
        </p>
      </main>
      <Footer />
    </>
  );
}
