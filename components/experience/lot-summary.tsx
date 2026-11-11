import Link from "next/link";
import { formatNumber } from "../../lib/experience/brew";
import type { ExperienceCoffee } from "../../lib/experience/coffee";
import type { BrewMethod } from "../../lib/experience/schema";

/**
 * "Dados deste lote": who, where, how it was processed, what to expect in the
 * cup and how to brew it — only from published fields, each with its source.
 * Missing data is said plainly instead of being filled with general text.
 */
export function LotSummary({
  coffee,
  labelMethods,
}: {
  coffee: ExperienceCoffee;
  labelMethods: BrewMethod[];
}) {
  const origin = coffee.origin;
  const where = [
    origin?.farm,
    origin?.region,
    origin?.altitudeMeters
      ? `${formatNumber(origin.altitudeMeters)} m de altitude`
      : null,
  ].filter(Boolean);
  const how = [
    coffee.variety,
    coffee.process
      ? `processo ${coffee.process.toLocaleLowerCase("pt-BR")}`
      : null,
    origin?.harvest ? `safra ${origin.harvest}` : null,
  ].filter(Boolean);
  const cup = [
    coffee.profile,
    coffee.sensory?.notes?.length
      ? `notas de ${coffee.sensory.notes.join(" e ").toLocaleLowerCase("pt-BR")}`
      : null,
    coffee.sensory?.acidity
      ? `acidez ${coffee.sensory.acidity.toLocaleLowerCase("pt-BR")}`
      : null,
    coffee.sensory?.body
      ? `corpo ${coffee.sensory.body.toLocaleLowerCase("pt-BR")}`
      : null,
    coffee.roast ? `torra ${coffee.roast.toLocaleLowerCase("pt-BR")}` : null,
  ].filter(Boolean);
  const rows: [string, React.ReactNode][] = [
    [
      "Quem produziu",
      origin?.producers?.length ? (
        <em>{origin.producers.join(" e ")}</em>
      ) : (
        "Ainda não publicado."
      ),
    ],
    [
      "Onde",
      where.length
        ? where.join(" · ")
        : "A origem detalhada ainda não está publicada.",
    ],
    [
      "Como foi processado",
      how.length ? how.join(" · ") : "Ainda não publicado.",
    ],
    [
      "O que esperar na xícara",
      cup.length ? cup.join("; ") : coffee.description,
    ],
    [
      "Como aproveitar no preparo",
      labelMethods.length ? (
        <>
          O rótulo sugere{" "}
          {coffee.preparations.join(" e ").toLocaleLowerCase("pt-BR")}:{" "}
          {labelMethods.map((method, index) => (
            <span key={method.id}>
              {index > 0 && ", "}
              <Link
                className="xp-text-link"
                href={`/experiencia/preparar/?cafe=${coffee.slug}&metodo=${method.id}`}
              >
                {method.name}
              </Link>
            </span>
          ))}
          .
        </>
      ) : (
        <>
          Qualquer método do{" "}
          <Link
            className="xp-text-link"
            href={`/experiencia/preparar/?cafe=${coffee.slug}`}
          >
            Laboratório
          </Link>{" "}
          é um bom começo.
        </>
      ),
    ],
  ];
  return (
    <section className="wrap xp-section xp-lot" aria-labelledby="lot-title">
      <div className="xp-section-head">
        <p className="eyebrow">
          DADOS DESTE LOTE{coffee.lotCode ? ` · ${coffee.lotCode}` : ""}
        </p>
        <h2 id="lot-title">
          Quem, onde <em>e como.</em>
        </h2>
      </div>
      <dl className="xp-lot-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="xp-source mono">
        Fonte: rótulo oficial do lote. Dados não publicados não são estimados.
      </p>
    </section>
  );
}
