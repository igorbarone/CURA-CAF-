import Link from "next/link";
import { Arrow } from "./arrow";
import { coffeePath, type CoffeeView } from "../lib/catalog-model";

export function ProducerFeature({ coffee }: { coffee: CoffeeView }) {
  return (
    <article className="producer-feature">
      <p className="eyebrow">
        {coffee.name} · {coffee.lot}
      </p>
      <h3>{coffee.producers}</h3>
      <p className="producer-origin">{coffee.origin}</p>
      {coffee.producerStory && (
        <p className="producer-story">{coffee.producerStory}</p>
      )}
      <Link className="text-link" href={`${coffeePath(coffee)}#origem`}>
        Conheça a origem de {coffee.name} <Arrow />
      </Link>
    </article>
  );
}
