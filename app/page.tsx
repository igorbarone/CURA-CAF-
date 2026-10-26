import { Arrow } from "../components/arrow";
import Link from "next/link";
import { Footer } from "../components/footer";
import { Journey } from "../components/brand";
import { Header } from "../components/header";
import { CoffeeCard } from "../components/coffee-card";
import { getHomeSelection } from "../lib/coffees";
import { projectCoffee } from "../lib/catalog-model";
const steps = [
  {
    title: "Encontrado.",
    text: "O começo é a origem brasileira. Cada café tem quem planta, cuida e produz. É de lá que parte a nossa escolha.",
  },
  {
    title: "Escolhido.",
    text: "A curadoria aproxima você de perfis diferentes. Do doce e cremoso ao frutado e cítrico: há mais de um jeito de gostar de café.",
  },
  {
    title: "Explicado.",
    text: "Notas, torra e preparo em uma linguagem simples. Para você entender a escolha e encontrar o seu jeito de beber.",
  },
];
export default function Home() {
  const { settings, entries } = getHomeSelection();
  return (
    <div id="inicio">
      <Header />
      <main id="conteudo">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="choice-dot" /> CAFÉS DE ORIGEM BRASILEIRA
            </p>
            <h1 id="hero-title">
              Da roça
              <br />à <em>cidade.</em>
            </h1>
            <p className="hero-description">
              Escolher muito bem.
              <br />
              Explicar de um jeito simples.
            </p>
            <Link className="button" href="/cafes/">
              Encontre o seu café{" "}
              <span aria-hidden="true">
                <Arrow />
              </span>
            </Link>
            <p className="hero-footnote mono">
              ENCONTRADO. ESCOLHIDO. EXPLICADO.
            </p>
          </div>
          <div className="hero-art">
            <Journey />
            <p className="origin-label mono">01 / ORIGEM</p>
            <div className="editorial-note">
              <span className="eyebrow">O PONTO DE ESCOLHA</span>
              <p>
                Entre a origem
                <br />e a sua xícara,
                <br />
                <em>uma boa escolha.</em>
              </p>
            </div>
            <p className="city-label mono">
              02 / SEU DIA A DIA{" "}
              <span aria-hidden="true">
                <Arrow />
              </span>
            </p>
            <span className="art-legend mono">
              UMA CURVA. UM ENCONTRO. UM NOVO CAMINHO.
            </span>
          </div>
        </section>
        <div className="manifesto-strip">
          <p>
            O produtor assina o café. <em>A Cura assina a escolha.</em>
          </p>
          <span aria-hidden="true">✳</span>
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
            <p className="section-intro">{settings.intro}</p>
          </div>
          <div className="coffee-grid">
            {entries.map((entry) => (
              <CoffeeCard key={entry.coffee.id} coffee={projectCoffee(entry)} />
            ))}
          </div>
          {!entries.length && (
            <p className="body-copy">
              Estamos preparando a próxima seleção.{" "}
              <Link href="/cafes/">Explore o catálogo.</Link>
            </p>
          )}
          <p className="catalog-note mono">
            A origem detalhada será publicada após confirmação. Sem venda online
            nesta fase.
          </p>
        </section>
        <section
          className="curation"
          id="curadoria"
          aria-labelledby="curation-title"
        >
          <div className="wrap">
            <div className="section-heading">
              <div>
                <p className="eyebrow">02 / NOSSA MANEIRA DE ESCOLHER</p>
                <h2 id="curation-title">
                  Café bom não precisa
                  <br />
                  de <em>complicação.</em>
                </h2>
              </div>
              <p className="section-intro">
                Curadoria é dar atenção ao que importa — e dividir essa escolha
                com você.
              </p>
            </div>
            <div className="steps">
              {steps.map((step, index) => (
                <article key={step.title}>
                  <span className="step-number mono">
                    0{index + 1}{" "}
                    <span aria-hidden="true">
                      <Arrow />
                    </span>
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          className="story section wrap"
          id="historia"
          aria-labelledby="story-title"
        >
          <div className="story-drawing">
            <Journey />
            <p>
              O caminho muda.
              <br />
              <em>A origem importa.</em>
            </p>
            <span className="mono">DA ROÇA À CIDADE.</span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">03 / A CURA CAFÉ</p>
            <h2 id="story-title">
              Uma ponte entre
              <br />a origem e <em>você.</em>
            </h2>
            <p>
              A Cura Café existe para aproximar cafés de origem brasileira da
              vida na cidade. Nosso ponto de partida é uma ideia simples:
              escolher com critério e compartilhar o que torna cada café
              especial.
            </p>
            <p>
              Quem produz tem sua assinatura. A nossa está na escolha e no
              cuidado de explicar, sem complicar a sua relação com a xícara.
            </p>
            <a className="text-link" href="#cafes">
              Conheça a nossa seleção{" "}
              <span aria-hidden="true">
                <Arrow />
              </span>
            </a>
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
