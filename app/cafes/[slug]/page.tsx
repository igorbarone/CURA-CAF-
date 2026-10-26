import { Arrow } from "../../../components/arrow";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { coffees } from "../../../lib/coffees";
import { Header } from "../../../components/header";
import { Footer } from "../../../components/footer";
import { Breadcrumbs } from "../../../components/breadcrumbs";
import { CoffeeArt } from "../../../components/coffee-art";
import { CoffeeCard } from "../../../components/coffee-card";
import { CommerceStatus } from "../../../components/commerce-status";
export const dynamicParams = false;
export function generateStaticParams() {
  return coffees.map(({ slug }) => ({ slug }));
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const coffee = coffees.find((item) => item.slug === slug);
  return coffee
    ? {
        title: `${coffee.name} — ${coffee.notes} | Cura Café`,
        description: `${coffee.name}, lote ${coffee.lot}. ${coffee.notes}, torra ${coffee.roast.toLowerCase()}, ${coffee.score} pontos SCAA. Conheça o perfil e quem produz.`,
      }
    : {};
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const coffee = coffees.find((item) => item.slug === slug);
  if (!coffee) notFound();
  const other = coffees.find((item) => item.slug !== slug)!;
  return (
    <>
      <Header />
      <main className="wrap product-page" id="conteudo">
        <Breadcrumbs current={coffee.name} product />
        <section
          className={`product-hero ${coffee.tone}`}
          aria-labelledby="product-name"
        >
          <CoffeeArt coffee={coffee} />
          <div className="product-summary">
            <p className="eyebrow">
              {coffee.lot} · {coffee.score} PONTOS SCAA
            </p>
            <h1 id="product-name">
              {coffee.name}
              <span>{coffee.profile}</span>
            </h1>
            <p className="coffee-notes">{coffee.notes}</p>
            <p className="body-copy">{coffee.description}</p>
            <p className="product-roast mono">
              TORRA {coffee.roast.toUpperCase()} · {coffee.preparation}
            </p>
            <CommerceStatus />
          </div>
        </section>
        <section className="product-details" aria-labelledby="sensory-title">
          <div>
            <p className="eyebrow">01 / NA XÍCARA</p>
            <h2 id="sensory-title">
              O sabor,
              <br />
              <em>sem complicação.</em>
            </h2>
            <p className="body-copy">
              Notas sensoriais descrevem lembranças de aroma e sabor do café.
              Não são ingredientes adicionados.
            </p>
          </div>
          <dl className="fact-grid">
            <div>
              <dt>Notas sensoriais</dt>
              <dd>{coffee.notes}</dd>
            </div>
            <div>
              <dt>Acidez</dt>
              <dd>{coffee.acidity}</dd>
            </div>
            <div>
              <dt>Corpo</dt>
              <dd>{coffee.body ?? "Informação a confirmar"}</dd>
            </div>
            <div>
              <dt>Torra</dt>
              <dd>{coffee.roast}</dd>
            </div>
            <div>
              <dt>Pontuação SCAA</dt>
              <dd>{coffee.score} pontos</dd>
            </div>
            <div>
              <dt>Experimente no preparo</dt>
              <dd>{coffee.preparation}</dd>
            </div>
          </dl>
        </section>
        <section
          className="product-details origin-details"
          aria-labelledby="origin-title"
        >
          <div>
            <p className="eyebrow">02 / QUEM ASSINA O CAFÉ</p>
            <h2 id="origin-title">
              Da origem,
              <br />
              <em>com respeito.</em>
            </h2>
          </div>
          <div>
            <dl className="fact-grid">
              <div>
                <dt>Produtores</dt>
                <dd>{coffee.producers}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{coffee.origin}</dd>
              </div>
              <div>
                <dt>Variedade</dt>
                <dd>{coffee.variety ?? "Informação a confirmar"}</dd>
              </div>
              <div>
                <dt>Rastreabilidade</dt>
                <dd>{coffee.lot}</dd>
              </div>
            </dl>
            <p className="body-copy">
              Publicamos o que está confirmado. Município, altitude, safra e
              outros detalhes serão acrescentados após validação, sem preencher
              lacunas com suposições.
            </p>
          </div>
        </section>
        <section className="related-section" aria-labelledby="related-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CONTINUE A DESCOBERTA</p>
              <h2 id="related-title">
                Outro jeito
                <br />
                de <em>sentir.</em>
              </h2>
            </div>
            <Link className="text-link" href="/cafes/">
              Ver todos os cafés{" "}
              <span aria-hidden="true">
                <Arrow />
              </span>
            </Link>
          </div>
          <div className="related-card">
            <CoffeeCard coffee={other} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
