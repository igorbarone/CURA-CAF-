"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "../arrow";
import { CoffeeMedia } from "./coffee-media";
import { useCoffeeContext } from "./coffee-context";
import { trackExperience } from "../../lib/experience/analytics";
import type { ExperienceCoffee } from "../../lib/experience/coffee";

/**
 * First step after the QR: "Qual café está na sua mão?". Picking a package
 * keeps it for the whole Experience and puts "Quero preparar meu café" one
 * tap away; learning and the Barista stay as secondary paths.
 */
export function PackagePicker({ coffees }: { coffees: ExperienceCoffee[] }) {
  const { coffeeSlug, setCoffee } = useCoffeeContext();
  const [chosen, setChosen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const coffee = coffees.find((item) => item.slug === coffeeSlug);
  useEffect(() => {
    if (chosen) heading.current?.focus();
  }, [chosen, coffeeSlug]);
  if (!coffees.length)
    return (
      <p className="xp-empty">
        Nossa seleção está sendo preparada. Volte em breve.
      </p>
    );
  return (
    <div className="xp-picker">
      <div
        className="xp-picker-grid"
        role="group"
        aria-label="Escolha o seu café"
      >
        {coffees.map((item) => (
          <button
            key={item.slug}
            type="button"
            className={`xp-package ${item.tone}`}
            aria-pressed={coffeeSlug === item.slug}
            onClick={() => {
              setCoffee(item.slug);
              setChosen(true);
              trackExperience("coffee_select", {
                coffee: item.slug,
                context: "entrada",
              });
            }}
          >
            <CoffeeMedia coffee={item} sizes="(max-width: 760px) 33vw, 240px" />
            <span className="xp-package-name">{item.name}</span>
            <span className="xp-package-facts mono">
              {item.score !== undefined
                ? `${item.score} pontos`
                : item.category}
            </span>
          </button>
        ))}
      </div>
      {coffee ? (
        <div className="xp-picker-actions" aria-live="polite">
          <h2 ref={heading} tabIndex={-1}>
            {coffee.name}. <em>O que você quer fazer?</em>
          </h2>
          <Link
            className="button xp-primary-action"
            href={`/experiencia/preparar/?cafe=${coffee.slug}`}
          >
            Quero preparar meu café <Arrow />
          </Link>
          <ul className="xp-secondary-actions">
            <li>
              <Link href={`/experiencia/cafes/${coffee.slug}/`}>
                Conhecer meu café
              </Link>
            </li>
            <li>
              <Link href="/experiencia/aprender/">Aprender sobre café</Link>
            </li>
            <li>
              <Link href="/experiencia/barista/">
                Conversar com o Barista Cura
              </Link>
            </li>
          </ul>
        </div>
      ) : (
        <p className="xp-picker-hint">
          Toque no seu café. Já sabe o que quer?{" "}
          <Link className="xp-text-link" href="/experiencia/preparar/">
            Ir direto para o preparo
          </Link>
        </p>
      )}
    </div>
  );
}
