import { metadataFor } from "../../../lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getProduct, getProductRoutes } from "../../../lib/coffees";
import { projectCoffee } from "../../../lib/catalog-model";
import { ProductDetail } from "../../../components/product-detail";
import { Header } from "../../../components/header";
import { Footer } from "../../../components/footer";
import { Breadcrumbs } from "../../../components/breadcrumbs";
import { contactLinks, getContact } from "../../../lib/contact";
export const dynamicParams = false;
export function generateStaticParams() {
  return getProductRoutes();
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = getProduct(slug);
  if (!entry) return {};
  const coffee = projectCoffee(entry);
  if (coffee.status === "archived")
    return {
      title: `${coffee.name} — Arquivado | Cura Café`,
      robots: { index: false, follow: true },
    };
  return metadataFor(
    `${coffee.name} — ${coffee.notes} | Cura Café`,
    `${coffee.name}, ${coffee.lot}. ${coffee.notes}, torra ${coffee.roast.toLowerCase()}. Conheça o perfil e quem produz.`,
    `cafes/${coffee.slug}/`,
  );
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const entry = getProduct(slug);
  if (!entry) notFound();
  if (entry.coffee.status === "archived")
    return (
      <>
        <Header />
        <main id="conteudo" className="wrap cart-page">
          <Breadcrumbs current={entry.coffee.name} product />
          <section className="empty-state">
            <p className="eyebrow">CAFÉ ARQUIVADO</p>
            <h1>{entry.coffee.name}</h1>
            <p>
              Este café não faz parte da seleção atual. Conheça os cafés da
              nossa curadoria.
            </p>
            <Link className="button" href="/cafes/">
              Explorar os cafés
            </Link>
          </section>
        </main>
        <Footer />
      </>
    );
  const related = getCatalog().filter(
    (item) => item.coffee.id !== entry.coffee.id,
  );
  const contact = getContact();
  const contactByLot = Object.fromEntries(
    entry.lots.map((lot) => [
      lot.id,
      contactLinks(
        contact,
        `Olá, Cura Café! Quero saber mais sobre o ${entry.coffee.name} (lote ${lot.code}).`,
      ),
    ]),
  );
  return (
    <>
      <Header />
      <ProductDetail
        key={entry.coffee.id}
        entry={entry}
        related={related}
        contactByLot={contactByLot}
      />
      <Footer />
    </>
  );
}
