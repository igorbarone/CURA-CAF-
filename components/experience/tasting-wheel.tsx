"use client";
import { useEffect, useState } from "react";
import { trackExperience } from "../../lib/experience/analytics";
import { readLocal, writeLocal } from "../../lib/experience/storage";
import type { TastingAttribute } from "../../lib/experience/schema";

const KEY = "cura-experience-tasting";
type TastingNote = { coffee: string; values: { [attribute: string]: number } };
const scale = ["", "Pouco", "Leve", "Médio", "Marcante", "Muito marcante"];
const palette = [
  "#8E521C",
  "#BF9A50",
  "#2D5B7B",
  "#7E5C43",
  "#3A2618",
  "#8B2A3C",
  "#5E3C73",
];

function segment(index: number, total: number) {
  const start = (index / total) * Math.PI * 2 - Math.PI / 2;
  const end = ((index + 1) / total) * Math.PI * 2 - Math.PI / 2;
  const point = (r: number, a: number) =>
    `${100 + r * Math.cos(a)} ${100 + r * Math.sin(a)}`;
  return `M ${point(46, start)} L ${point(96, start)} A 96 96 0 0 1 ${point(96, end)} L ${point(46, end)} A 46 46 0 0 0 ${point(46, start)} Z`;
}

/**
 * Interactive sensory wheel: select a characteristic to learn how to notice
 * it, then note how it showed up in today's cup. Saved only in this browser.
 */
export function TastingWheel({
  attributes,
  coffees,
}: {
  attributes: TastingAttribute[];
  coffees: { slug: string; name: string }[];
}) {
  const [active, setActive] = useState(0);
  const [record, setRecord] = useState<TastingNote>({ coffee: "", values: {} });
  const [saved, setSaved] = useState(false);
  useEffect(
    () => setRecord(readLocal<TastingNote>(KEY, { coffee: "", values: {} })),
    [],
  );
  const attribute = attributes[active];
  const update = (next: TastingNote) => {
    setRecord(next);
    writeLocal(KEY, next);
    setSaved(true);
  };
  const noted = attributes.filter((item) => record.values[item.id]);
  return (
    <div className="xp-wheel">
      <div className="xp-wheel-figure">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          {attributes.map((item, index) => (
            <path
              key={item.id}
              d={segment(index, attributes.length)}
              fill={palette[index % palette.length]}
              opacity={
                index === active
                  ? 1
                  : 0.28 + (record.values[item.id] ?? 0) * 0.1
              }
              onClick={() => setActive(index)}
            />
          ))}
        </svg>
        <span className="xp-wheel-center mono" aria-hidden="true">
          {attribute.name}
        </span>
      </div>
      <div>
        <div
          className="xp-chips xp-wheel-buttons"
          role="tablist"
          aria-label="Características sensoriais"
        >
          {attributes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-controls="roda-painel"
              onClick={() => {
                setActive(index);
                trackExperience("content_view", {
                  content: `atributo-${item.id}`,
                });
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div
          id="roda-painel"
          role="tabpanel"
          className="xp-wheel-panel"
          aria-live="polite"
        >
          <h3>{attribute.name}</h3>
          <p>{attribute.definition}</p>
          <p>
            <strong>Como perceber:</strong> {attribute.howTo}
          </p>
          <p className="xp-small">
            <em>{attribute.analogy}</em>
          </p>
          <fieldset className="xp-rate">
            <legend>
              Na sua xícara de hoje, {attribute.name.toLocaleLowerCase("pt-BR")}{" "}
              foi:
            </legend>
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`rate-${attribute.id}`}
                  checked={record.values[attribute.id] === value}
                  onChange={() =>
                    update({
                      ...record,
                      values: { ...record.values, [attribute.id]: value },
                    })
                  }
                />
                <span>{scale[value]}</span>
              </label>
            ))}
          </fieldset>
        </div>
        <div className="xp-wheel-record">
          <label>
            Qual café você está provando?
            <select
              value={record.coffee}
              onChange={(event) =>
                update({ ...record, coffee: event.target.value })
              }
            >
              <option value="">Prefiro não dizer</option>
              {coffees.map((coffee) => (
                <option key={coffee.slug} value={coffee.slug}>
                  {coffee.name}
                </option>
              ))}
            </select>
          </label>
          {noted.length > 0 && (
            <>
              <ul className="xp-wheel-summary">
                {noted.map((item) => (
                  <li key={item.id}>
                    <span>{item.name}</span>
                    <span className="mono">
                      {scale[record.values[item.id]]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="xp-small" role="status">
                {saved ? "Anotado neste navegador. " : ""}Sua percepção é
                pessoal: não existe resposta errada.
              </p>
              <button
                type="button"
                className="xp-text-link"
                onClick={() => update({ coffee: "", values: {} })}
              >
                Limpar anotações
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
