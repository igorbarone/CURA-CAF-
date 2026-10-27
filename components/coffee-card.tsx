import { Arrow } from "./arrow";
import Link from "next/link";
import { CoffeeArt } from "./coffee-art";
import { CompareToggle } from "./compare-toggle";
import { RoastMeter } from "./roast-meter";
import { coffeePath, type CoffeeView } from "../lib/catalog-model";
export function CoffeeCard({ coffee }: { coffee: CoffeeView }) {
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
        <dl className="lot-facts">
          <div>
            <dt>Torra</dt>
            <dd>
              <RoastMeter roast={coffee.roast} />
            </dd>
          </div>
          <div>
            <dt>Pontuação SCA</dt>
            <dd className="score-value">
              {coffee.score !== null ? `${coffee.score} pontos` : "A confirmar"}
            </dd>
          </div>
        </dl>
        <p className="profile-tag">{coffee.profile}</p>
        <p className="coffee-notes">{coffee.notes}</p>
        <SensoryChips acidity={coffee.acidity} body={coffee.body} />
        <p className="body-copy">{coffee.description}</p>
        <dl>
          <div>
            <dt>Quem produz</dt>
            <dd>{coffee.producers}</dd>
          </div>
          <div>
            <dt>Na sua xícara</dt>
            <dd>{coffee.preparation}</dd>
          </div>
        </dl>
        <div className="card-actions">
          <Link className="button" href={coffeePath(coffee)}>
            Conheça {coffee.name}{" "}
            <span aria-hidden="true">
              <Arrow />
            </span>
          </Link>
          <CompareToggle slug={coffee.slug} name={coffee.name} />
        </div>
        <p className="availability">Preço e disponibilidade a confirmar.</p>
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
