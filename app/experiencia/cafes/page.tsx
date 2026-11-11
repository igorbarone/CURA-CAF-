import type { Metadata } from "next";
import { CoffeePicker } from "../../../components/experience/coffee-picker";
import { getExperienceCoffees } from "../../../lib/experience/content";
import { metadataFor } from "../../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Meu café | CURA Experience",
  "Escolha o seu café da Cura e conheça origem, quem produz, perfil sensorial e como preparar.",
  "experiencia/cafes/",
);

export default function ExperienceCoffees() {
  const coffees = getExperienceCoffees();
  return (
    <div className="wrap xp-page">
      <header className="xp-page-head">
        <p className="eyebrow">MEU CAFÉ</p>
        <h1>
          Qual é o <em>seu café?</em>
        </h1>
        <p className="xp-lead">
          Cada café tem uma experiência própria. Você pode trocar de café a
          qualquer momento.
        </p>
      </header>
      <CoffeePicker coffees={coffees} headingLevel="h2" />
    </div>
  );
}
