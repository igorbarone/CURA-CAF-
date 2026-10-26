import { Arrow } from "./arrow";
import Link from "next/link";
import { CoffeeArt } from "./coffee-art";
import { coffees } from "../lib/coffees";
export function CoffeeCard({ coffee }: { coffee: (typeof coffees)[number] }) {
  return (
    <article
      className={`coffee-card ${coffee.tone}`}
      aria-labelledby={`cafe-${coffee.lot}`}
    >
      <CoffeeArt coffee={coffee} />
      <div className="coffee-info">
        <p className="eyebrow">
          {coffee.lot} <span>Torra {coffee.roast.toLowerCase()}</span>
        </p>
        <h3 id={`cafe-${coffee.lot}`}>
          <Link href={`/cafes/${coffee.slug}/`}>{coffee.name}</Link>
        </h3>
        <p className="coffee-notes">{coffee.notes}</p>
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
        <Link className="text-link" href={`/cafes/${coffee.slug}/`}>
          Conheça {coffee.name}{" "}
          <span aria-hidden="true">
            <Arrow />
          </span>
        </Link>
        <p className="availability">Preço e disponibilidade a confirmar.</p>
      </div>
    </article>
  );
}
