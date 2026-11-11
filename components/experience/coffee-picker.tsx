import Link from "next/link";
import { Arrow } from "../arrow";
import { CoffeeMedia } from "./coffee-media";
import type { ExperienceCoffee } from "../../lib/experience/coffee";

export function CoffeeFacts({ coffee }: { coffee: ExperienceCoffee }) {
  const facts = [
    coffee.category,
    coffee.score !== undefined ? `${coffee.score} pontos` : null,
    coffee.roast ? `Torra ${coffee.roast.toLocaleLowerCase("pt-BR")}` : null,
  ].filter(Boolean);
  return <p className="xp-facts mono">{facts.join(" · ")}</p>;
}

/** Coffee selection; works with any number of published coffees. */
export function CoffeePicker({
  coffees,
  current,
  headingLevel = "h3",
}: {
  coffees: ExperienceCoffee[];
  current?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  if (!coffees.length)
    return (
      <p className="xp-empty">
        Nossa seleção está sendo preparada. Volte em breve para conhecer os
        cafés da Cura.
      </p>
    );
  return (
    <ul className="xp-coffee-grid">
      {coffees.map((coffee) => (
        <li key={coffee.id}>
          <article
            className={`xp-coffee-card ${coffee.tone} ${current === coffee.slug ? "is-current" : ""}`}
          >
            <CoffeeMedia coffee={coffee} />
            <div className="xp-coffee-card-body">
              <CoffeeFacts coffee={coffee} />
              <Heading>
                <Link
                  href={`/experiencia/cafes/${coffee.slug}/`}
                  aria-current={current === coffee.slug ? "page" : undefined}
                >
                  {coffee.name}
                  <span className="xp-card-cover" aria-hidden="true" />
                </Link>
              </Heading>
              {coffee.sensory?.notes?.length ? (
                <p className="xp-notes">
                  <em>{coffee.sensory.notes.join(", ")}</em>
                </p>
              ) : (
                <p className="xp-notes">{coffee.description}</p>
              )}
              <span className="xp-card-go mono" aria-hidden="true">
                {current === coffee.slug ? "Você está aqui" : "Conhecer"}{" "}
                <Arrow />
              </span>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
