"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Arrow } from "./arrow";
import { RoastMeter } from "./roast-meter";
import { useCompare } from "./compare-provider";
import {
  coffeePath,
  projectCoffee,
  type CatalogEntry,
} from "../lib/catalog-model";
import { MAX_COMPARE, comparePath, parseCompareSlugs } from "../lib/compare";
const pending = "A confirmar";
export function Comparator({ entries }: { entries: CatalogEntry[] }) {
  const coffees = entries.map((entry) => projectCoffee(entry));
  const validSlugs = coffees.map((coffee) => coffee.slug);
  const { slugs, replace, toggle, ready: stored } = useCompare();
  const [ready, setReady] = useState(false);
  // A shared link wins over the visitor's session; with a small catalog and
  // nothing chosen yet, compare everything that fits.
  useEffect(() => {
    if (!stored || ready) return;
    const requested = parseCompareSlugs(
      new URLSearchParams(window.location.search).get("cafes"),
      validSlugs,
    );
    if (requested.length) replace(requested);
    else if (!slugs.length && validSlugs.length <= MAX_COMPARE)
      replace(validSlugs);
    setReady(true);
    // Runs once, after the session selection loads; later changes come from
    // the checkboxes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);
  useEffect(() => {
    if (ready)
      window.history.replaceState(
        null,
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${comparePath(slugs)}`,
      );
  }, [slugs, ready]);
  if (!coffees.length)
    return (
      <div className="empty-state">
        <h2>Novas escolhas estão a caminho.</h2>
        <p>Quando houver cafés publicados, você poderá compará-los aqui.</p>
        <Link className="button" href="/cafes/">
          Explorar o catálogo
        </Link>
      </div>
    );
  // Before the session loads (and in the static HTML), show what fits.
  const active = ready ? slugs : validSlugs.slice(0, MAX_COMPARE);
  const chosen = active
    .map((slug) => coffees.find((coffee) => coffee.slug === slug))
    .filter((coffee) => coffee !== undefined);
  const rows: [
    string,
    (coffee: (typeof coffees)[number]) => React.ReactNode,
  ][] = [
    ["Perfil", (coffee) => coffee.profile],
    ["Notas sensoriais", (coffee) => coffee.notes],
    [
      "Pontuação SCA",
      (coffee) =>
        coffee.score !== null ? (
          <span className="score-badge">
            {coffee.score} <small>pontos</small>
          </span>
        ) : (
          pending
        ),
    ],
    ["Torra", (coffee) => <RoastMeter roast={coffee.roast} />],
    ["Acidez", (coffee) => coffee.acidity ?? pending],
    ["Corpo", (coffee) => coffee.body ?? pending],
    ["Experimente no preparo", (coffee) => coffee.preparation],
    ["Quem produz", (coffee) => coffee.producers],
    ["Origem", (coffee) => coffee.origin],
    ["Variedade", (coffee) => coffee.variety ?? pending],
    ["Lote", (coffee) => coffee.lot],
    ["Preço e disponibilidade", () => pending],
  ];
  return (
    <>
      <fieldset className="compare-picker">
        <legend>
          Escolha até {MAX_COMPARE} cafés{" "}
          <span className="mono">
            ({chosen.length} de {MAX_COMPARE})
          </span>
        </legend>
        <div className="filter-options">
          {coffees.map((coffee) => {
            const selected = active.includes(coffee.slug);
            return (
              <label
                key={coffee.slug}
                className={`compare-choice ${coffee.tone}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={!selected && active.length >= MAX_COMPARE}
                  onChange={() => toggle(coffee.slug)}
                />
                <span>{coffee.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {chosen.length ? (
        <div
          className="compare-scroll"
          role="region"
          aria-label="Tabela de comparação"
          tabIndex={0}
        >
          <table className="compare-table">
            <caption className="visually-hidden">
              Comparação de {chosen.map((coffee) => coffee.name).join(", ")}
            </caption>
            <thead>
              <tr>
                <td />
                {chosen.map((coffee) => (
                  <th key={coffee.slug} scope="col" className={coffee.tone}>
                    <span className="compare-lot mono">{coffee.lot}</span>
                    <Link href={coffeePath(coffee)}>{coffee.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {chosen.map((coffee) => (
                    <td key={coffee.slug}>{value(coffee)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                {chosen.map((coffee) => (
                  <td key={coffee.slug}>
                    <Link className="button" href={coffeePath(coffee)}>
                      Conheça {coffee.name} <Arrow />
                    </Link>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="body-copy">
          Escolha ao menos um café acima para ver a comparação.
        </p>
      )}
      <p className="quiz-privacy mono">
        Dados publicados de cada lote, lado a lado. Notas descrevem sensações,
        não ingredientes. Preço e disponibilidade a confirmar.
      </p>
    </>
  );
}
