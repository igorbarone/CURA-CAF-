import Link from "next/link";
import { Arrow } from "../arrow";
import { HarvestCycle } from "./harvest-cycle";
import { RoastLevels } from "./roast-levels";
import { OriginMap } from "./origin-map";
import { JourneyProgress } from "./journey-progress";
import { formatNumber } from "../../lib/experience/brew";
import type { ExperienceCoffee } from "../../lib/experience/coffee";
import type { Journey } from "../../lib/experience/schema";

const stages = [
  { id: "terra", label: "A terra" },
  { id: "produtor", label: "O produtor" },
  { id: "colheita", label: "A colheita" },
  { id: "torra", label: "A torra" },
  { id: "xicara", label: "A xícara" },
];

/**
 * Da fazenda à xícara. With a coffee, each stage shows only its confirmed
 * data; without one (or with missing data) the stage stays educational.
 */
export function OriginJourney({
  journey,
  coffee,
}: {
  journey: Journey;
  coffee?: ExperienceCoffee;
}) {
  const origin = coffee?.origin;
  const land = [
    origin?.region && ["Região", origin.region],
    origin?.farm && ["Fazenda", origin.farm],
    origin?.altitudeMeters && [
      "Altitude",
      `${formatNumber(origin.altitudeMeters)} m`,
    ],
    origin?.harvest && ["Safra", origin.harvest],
    coffee?.variety && ["Variedade", coffee.variety],
    coffee?.process && ["Processo", coffee.process],
  ].filter(Boolean) as [string, string][];
  const producers = origin?.producers ?? [];
  const brewHref = coffee
    ? `/experiencia/preparar/?cafe=${coffee.slug}`
    : "/experiencia/preparar/";
  return (
    <div className="xp-journey">
      <JourneyProgress stages={stages} />
      <section id="terra" className="xp-stage" aria-labelledby="terra-title">
        <p className="eyebrow">ETAPA 1</p>
        <h2 id="terra-title">A terra</h2>
        <div className="xp-stage-grid">
          <div>
            <p className="xp-context-tag mono">CONTEXTO GERAL</p>
            <h3>{journey.terroir.title}</h3>
            <p>{journey.terroir.text}</p>
            <blockquote className="xp-quote">
              <em>“{journey.terroir.analogy}”</em>
            </blockquote>
          </div>
          {land.length > 0 ? (
            <div className="xp-origin-card xp-dark">
              <p className="eyebrow">DADOS DO LOTE · {coffee?.name}</p>
              <dl className="xp-dl">
                {land.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {origin?.altitudeMeters && origin.altitudeMeters >= 1000 && (
                <p className="xp-small">
                  Em altitudes mais elevadas, as temperaturas costumam ser mais
                  amenas e o fruto tende a amadurecer mais devagar, o que pode
                  favorecer a formação de açúcares e acidez.
                </p>
              )}
              {coffee && <OriginMap coffee={coffee} />}
              <p className="xp-source mono">Fonte: rótulo oficial</p>
            </div>
          ) : (
            coffee && (
              <div className="xp-origin-card">
                <p>
                  {coffee.name} é um{" "}
                  {coffee.category.toLocaleLowerCase("pt-BR")}. A origem
                  detalhada deste café ainda não está publicada, e aqui só
                  mostramos dados confirmados.
                </p>
              </div>
            )
          )}
        </div>
      </section>
      <section
        id="produtor"
        className="xp-stage"
        aria-labelledby="produtor-title"
      >
        <p className="eyebrow">ETAPA 2</p>
        <h2 id="produtor-title">O produtor</h2>
        <div className="xp-stage-grid">
          <div>
            {producers.length > 0 ? (
              <>
                <p className="xp-producer-names">
                  <em>{producers.join(" e ")}</em>
                </p>
                <p>
                  {producers.length > 1 ? "Assinam" : "Assina"} este lote. O
                  produtor assina o café. A Cura assina a escolha.
                </p>
              </>
            ) : (
              <p>
                Por trás de cada café há pessoas que cultivam, colhem e cuidam
                de cada etapa. Quando os nomes e histórias são confirmados, eles
                aparecem aqui.
              </p>
            )}
            {coffee?.story?.producer && (
              <p className="xp-story">{coffee.story.producer}</p>
            )}
          </div>
          <div className="xp-origin-card">
            <h3>{journey.curation.title}</h3>
            <p>{journey.curation.text}</p>
            {coffee?.story?.curation && (
              <p className="xp-story">
                <strong>Por que escolhemos:</strong> {coffee.story.curation}
              </p>
            )}
          </div>
        </div>
      </section>
      <section
        id="colheita"
        className="xp-stage"
        aria-labelledby="colheita-title"
      >
        <p className="eyebrow">ETAPA 3</p>
        <h2 id="colheita-title">A colheita</h2>
        <p className="xp-context-tag mono">CONTEXTO GERAL</p>
        <p className="xp-lead">
          Do pé de café ao grão verde: toque em cada etapa do ciclo.
        </p>
        <HarvestCycle cycle={journey.cycle} process={coffee?.process} />
      </section>
      <section id="torra" className="xp-stage" aria-labelledby="torra-title">
        <p className="eyebrow">ETAPA 4</p>
        <h2 id="torra-title">A torra</h2>
        <p className="xp-context-tag mono">CONTEXTO GERAL</p>
        <p className="xp-lead">
          A torra transforma o grão verde em café aromático. Compare os níveis.
        </p>
        <RoastLevels
          roasts={journey.roasts}
          note={journey.roastNote}
          coffeeRoast={coffee?.roast}
          coffeeName={coffee?.name}
        />
      </section>
      <section
        id="xicara"
        className="xp-stage xp-cup xp-dark"
        aria-labelledby="xicara-title"
      >
        <div className="xp-cup-art" aria-hidden="true">
          <span className="xp-cup-bean" />
          <span className="xp-cup-drop" />
          <span className="xp-cup-mug" />
        </div>
        <p className="eyebrow">ETAPA 5 · A XÍCARA</p>
        <h2 id="xicara-title">{journey.cup.title}</h2>
        <p>{journey.cup.text}</p>
        <Link className="button xp-on-dark" href={brewHref}>
          {journey.cup.cta} <Arrow />
        </Link>
      </section>
    </div>
  );
}
