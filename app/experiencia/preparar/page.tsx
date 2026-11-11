import type { Metadata } from "next";
import { BrewLab } from "../../../components/experience/brew-lab";
import { getExperience } from "../../../lib/experience/content";
import { metadataFor } from "../../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Laboratório de Preparo | CURA Experience",
  "Receita calculada para o seu equipamento, calculadora de proporção, passo a passo com cronômetro e diagnóstico do preparo.",
  "experiencia/preparar/",
);

export default function BrewPage() {
  const { methods, coffees, diagnosis } = getExperience();
  return (
    <div className="wrap xp-page">
      <header className="xp-page-head">
        <p className="eyebrow">LABORATÓRIO DE PREPARO</p>
        <h1>
          Seu café, <em>do seu jeito.</em>
        </h1>
        <p className="xp-lead">
          Escolha o café e o equipamento: calculamos a receita, mostramos o
          passo a passo e cronometramos cada despejo.
        </p>
      </header>
      <BrewLab methods={methods} coffees={coffees} diagnosis={diagnosis} />
    </div>
  );
}
