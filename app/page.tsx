import type { Metadata } from "next";
import { metadataFor } from "../lib/seo";
import Link from "next/link";
import { Arrow } from "../components/arrow";
import { Footer } from "../components/footer";
import { Journey } from "../components/brand";
import { Header } from "../components/header";
import { EditorialTopics } from "../components/editorial-topics";
import { ProducerFeature } from "../components/producer-feature";
import { CoffeeCard } from "../components/coffee-card";
import { getHomeSelection } from "../lib/coffees";
import { getEditorial } from "../lib/editorial";
import { projectCoffee } from "../lib/catalog-model";
export const metadata: Metadata = metadataFor(
  "Cura Café | Democratizar café especial.",
  getEditorial().hero.description,
  "",
);

export default function Home() {
  const { settings, entries } = getHomeSelection();
  const { hero, curation, story, club, access, producers } = getEditorial();
  const producerCoffees = entries.flatMap((entry) => {
    const coffee = projectCoffee(entry);
    return entry.lots.find((lot) => lot.id === coffee.lotId)?.producers.length
      ? [coffee]
      : [];
  });
  return (
    <div id="inicio" className="home-v1">
      <Header />
      <main id="conteudo">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="choice-dot" />
              {hero.eyebrow}
            </p>
            <h1 id="hero-title">
              {hero.line1}
              <br />
              <em>{hero.line2}</em>
            </h1>
            <p className="hero-description">{hero.description}</p>
            <div className="hero-actions">
              <Link className="button" href="/cafes/">
                {hero.primaryCta}
                <Arrow />
              </Link>
              <Link className="text-link" href="/descubra/">
                {hero.secondaryCta}
                <Arrow />
              </Link>
            </div>
            <p className="hero-footnote mono">
              ENCONTRADO. ESCOLHIDO. EXPLICADO.
            </p>
          </div>
          <div className="hero-art">
            <div className="hero-art-top">
              <span className="eyebrow">ORIGEM → ESCOLHA → CIDADE</span>
              <span className="choice-dot" />
            </div>

            <Journey />
            <div className="hero-editorial-note">
              <p className="origin-signature">
                <em>{hero.originSignature}</em>
              </p>
              <span className="mono">CURADORIA BRASILEIRA</span>
            </div>
            <p className="hero-art-caption">
              Encontrado. Escolhido. Explicado.
            </p>
          </div>
        </section>
        <div className="manifesto-strip">
          <p>{hero.artLabel}</p>
        </div>
        <section
          className="section wrap"
          id="cafes"
          aria-labelledby="cafes-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">{settings.eyebrow}</p>
              <h2 id="cafes-title">
                {settings.title}
                <br />
                <em>{settings.emphasis}</em>
              </h2>
            </div>
            <div className="selection-intro">
              <p className="section-intro">{settings.intro}</p>
              <Link className="text-link" href="/cafes/">
                Explorar todos os cafés <Arrow />
              </Link>
            </div>
          </div>
          <div className="coffee-grid">
            {entries.map((entry) => (
              <CoffeeCard key={entry.coffee.id} coffee={projectCoffee(entry)} />
            ))}
            {entries.length > 0 && (
              <aside
                className="choice-help"
                aria-labelledby="choice-help-title"
              >
                <p className="eyebrow">EM DÚVIDA?</p>
                <h3 id="choice-help-title">
                  Compare lado a lado
                  <br />
                  <em>ou siga o seu paladar.</em>
                </h3>
                <p>
                  Veja notas, torra e pontuação juntas, ou responda três
                  perguntas e receba uma sugestão explicada.
                </p>
                <Link className="button" href="/comparar/">
                  Comparar cafés <Arrow />
                </Link>
                <Link className="text-link" href="/descubra/">
                  Descubra seu café <Arrow />
                </Link>
              </aside>
            )}
          </div>
          {!entries.length && (
            <p className="body-copy">
              Estamos preparando a próxima seleção.{" "}
              <Link href="/cafes/">Explore o catálogo.</Link>
            </p>
          )}
          <p className="catalog-note mono">
            Dados comerciais em confirmação · Sem venda online nesta fase.
          </p>
        </section>
        <section
          className="access-section section wrap"
          aria-labelledby="access-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">{access.eyebrow}</p>
              <h2 id="access-title">
                {access.title}
                <br />
                <em>{access.emphasis}</em>
              </h2>
            </div>
            <p className="section-intro">{access.intro}</p>
          </div>
          <EditorialTopics items={access.pillars} />
        </section>
        <section className="discovery-band">
          <div className="wrap discovery-inner">
            <div>
              <p className="eyebrow">NÃO SABE POR ONDE COMEÇAR?</p>
              <h2>
                Seu paladar.
                <br />
                <em>Um bom ponto de partida.</em>
              </h2>
            </div>
            <div>
              <p>
                Um caminho simples entre o que você gosta e os perfis da nossa
                seleção. Cada recomendação vem com uma explicação.
              </p>
              <Link className="button" href="/descubra/">
                Descubra seu café <Arrow />
              </Link>
            </div>
          </div>
        </section>
        <section
          className="curation"
          id="curadoria"
          aria-labelledby="curation-title"
        >
          <div className="wrap">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{curation.eyebrow}</p>
                <h2 id="curation-title">
                  {curation.title}
                  <br />
                  <em>{curation.emphasis}</em>
                </h2>
              </div>
              <p className="section-intro">{curation.intro}</p>
            </div>
            <div className="steps">
              {curation.steps.map((step, index) => (
                <article key={`${step.title}-${index}`}>
                  <span className="step-number mono">
                    0{index + 1}
                    <Arrow />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        {producerCoffees.length > 0 && (
          <section
            className="producers-section section wrap"
            aria-labelledby="producers-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">{producers.eyebrow}</p>
                <h2 id="producers-title">
                  {producers.title}
                  <br />
                  <em>{producers.emphasis}</em>
                </h2>
              </div>
              <p className="section-intro">{producers.intro}</p>
            </div>
            <div className="producer-grid">
              {producerCoffees.map((coffee) => (
                <ProducerFeature key={coffee.id} coffee={coffee} />
              ))}
            </div>
          </section>
        )}
        <section className="story section wrap" id="historia">
          <div className="story-drawing">
            <Journey />
            <p>
              A origem tem nome.
              <br />
              <em>A escolha, cuidado.</em>
            </p>
            <span className="mono">DA ROÇA À CIDADE.</span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">{story.eyebrow}</p>
            <h2>
              {story.title}
              <br />
              <em>{story.emphasis}</em>
            </h2>
            <p>{story.intro}</p>
            <p>{story.paragraphs[0]}</p>
            <Link className="text-link" href="/historia/">
              Conheça nossa história <Arrow />
            </Link>
          </div>
        </section>
        <section className="wrap club-invitation">
          <div>
            <p className="eyebrow">{club.eyebrow}</p>
            <h2>
              {club.title}
              <br />
              <em>O próximo capítulo.</em>
            </h2>
          </div>
          <div>
            <p>{club.intro}</p>
            <Link className="text-link" href="/clube/">
              Conheça a proposta futura <Arrow />
            </Link>
            <p className="mono">SEM PLANOS OU CONTRATAÇÃO DISPONÍVEIS</p>
          </div>
        </section>
        <section className="closing wrap" aria-label="Assinatura da marca">
          <p>
            Da origem, o café.
            <br />
            Da escolha, <em>o encontro.</em>
          </p>
          <a href="#inicio" aria-label="Voltar ao início">
            ↑
          </a>
        </section>
      </main>
      <Footer />
    </div>
  );
}
