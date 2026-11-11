"use client";
import { useState } from "react";
import type { Journey } from "../../lib/experience/schema";

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Interactive roast scale; the coffee's own roast is marked, never ranked. */
export function RoastLevels({
  roasts,
  note,
  coffeeRoast,
  coffeeName,
}: {
  roasts: Journey["roasts"];
  note: string;
  coffeeRoast?: string;
  coffeeName?: string;
}) {
  const own = coffeeRoast
    ? roasts.findIndex((roast) =>
        normalize(roast.name).includes(normalize(coffeeRoast)),
      )
    : -1;
  // Without a published roast, nothing is pre-selected: the scale is a
  // general comparison and must not look like this coffee's roast.
  const [active, setActive] = useState<number | null>(own >= 0 ? own : null);
  const roast = active === null ? null : roasts[active];
  return (
    <div className="xp-roast">
      <div
        className="xp-roast-scale"
        role="radiogroup"
        aria-label="Níveis de torra"
      >
        {roasts.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={index === active}
            onClick={() => setActive(index)}
            style={{ "--roast": item.color } as React.CSSProperties}
          >
            <span className="xp-bean" aria-hidden="true" />
            <span>{item.name}</span>
            {index === own && coffeeName && (
              <span className="xp-roast-own mono">{coffeeName}</span>
            )}
          </button>
        ))}
      </div>
      {!coffeeRoast && coffeeName && (
        <p className="xp-small">
          Comparação educativa: o rótulo do {coffeeName} não informa a torra.
        </p>
      )}
      {roast ? (
        <dl className="xp-dl xp-roast-detail" aria-live="polite">
          <div>
            <dt>Aroma</dt>
            <dd>{roast.aroma}</dd>
          </div>
          <div>
            <dt>Sabor</dt>
            <dd>{roast.flavor}</dd>
          </div>
          <div>
            <dt>Corpo</dt>
            <dd>{roast.body}</dd>
          </div>
          <div>
            <dt>Amargor</dt>
            <dd>{roast.bitterness}</dd>
          </div>
        </dl>
      ) : (
        <p className="xp-small" aria-live="polite">
          Toque em um nível de torra para comparar.
        </p>
      )}
      <p className="xp-small">{note}</p>
    </div>
  );
}
