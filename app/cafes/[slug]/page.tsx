import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCatalog, getProduct, getProductRoutes } from "../../../lib/coffees";
import { projectCoffee } from "../../../lib/catalog-model";
import { ProductDetail } from "../../../components/product-detail";
import { Header } from "../../../components/header";
import { Footer } from "../../../components/footer";
import { Breadcrumbs } from "../../../components/breadcrumbs";
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
  return {
    title: `${coffee.name} — ${coffee.notes} | Cura Café`,
    description: `${coffee.name}, ${coffee.lot}. ${coffee.notes}, torra ${coffee.roast.toLowerCase()}. Conheça o perfil e quem produz.`,
  };
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
  return (
    <ProductDetail key={entry.coffee.id} entry={entry} related={related} />
  );
}
