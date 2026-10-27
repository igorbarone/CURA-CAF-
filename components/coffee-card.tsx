import { Arrow } from "./arrow";
import Link from "next/link";
import { CoffeeArt } from "./coffee-art";
import { CompareToggle } from "./compare-toggle";
import { RoastMeter } from "./roast-meter";
import { coffeePath, type CoffeeView } from "../lib/catalog-model";
export function CoffeeCard({ coffee }: { coffee: CoffeeView }) {
  // Compact shop card: the full story, chips and description live on the ficha.
  return (
    <article
      className={`coffee-card ${coffee.tone}`}
      aria-labelledby={`cafe-${coffee.id}`}
    >
      <CoffeeArt coffee={coffee} />
      <div className="coffee-info">
        <p className="eyebrow">{coffee.lot}</p>
        <h3 id={`cafe-${coffee.id}`}>
          <Link href={coffeePath(coffee)}>{coffee.name}</Link>
        </h3>
        <p className="card-producers">de {coffee.producers}</p>
        <p className="card-taste">
          <span className="profile-tag">{coffee.profile}</span>
          <span className="coffee-notes">{coffee.notes}</span>
        </p>
        <dl className="lot-facts">
          <div>
            <dt>Pontuação SCA</dt>
            <dd className="score-value">
              {coffee.score !== null ? `${coffee.score} pontos` : "A confirmar"}
            </dd>
          </div>
          <div>
            <dt>Torra</dt>
            <dd>
              <RoastMeter roast={coffee.roast} />
            </dd>
          </div>
          <div>
            <dt>Bom para</dt>
            <dd>{coffee.preparation}</dd>
          </div>
        </dl>
        <p className="availability">Preço e disponibilidade a confirmar.</p>
        <div className="card-actions">
          <Link className="button" href={coffeePath(coffee)}>
            Conheça {coffee.name}{" "}
            <span aria-hidden="true">
              <Arrow />
            </span>
          </Link>
          <CompareToggle slug={coffee.slug} name={coffee.name} />
        </div>
      </div>
    </article>
  );
}
export function SensoryChips({
  acidity,
  body,
}: {
  acidity: string | null;
  body: string | null;
}) {
  const chips = [
    acidity && `Acidez ${acidity.toLocaleLowerCase("pt-BR")}`,
    body && `Corpo ${body.toLocaleLowerCase("pt-BR")}`,
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <ul className="sensory-chips" aria-label="Sensação na xícara">
      {chips.map((chip) => (
        <li key={chip as string}>{chip}</li>
      ))}
    </ul>
  );
}
