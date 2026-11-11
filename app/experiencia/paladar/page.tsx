import type { Metadata } from "next";
import { TasteQuiz } from "../../../components/experience/taste-quiz";
import { getExperience } from "../../../lib/experience/content";
import { metadataFor } from "../../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Descubra seu paladar | CURA Experience",
  "Seis perguntas para descobrir suas preferências na xícara e o café da Cura que combina com você.",
  "experiencia/paladar/",
);

export default function TastePage() {
  const { taste, coffees } = getExperience();
  return (
    <div className="wrap xp-page">
      <header className="xp-page-head">
        <p className="eyebrow">DESCUBRA SEU PALADAR</p>
        <h1>
          O que você procura <em>na xícara?</em>
        </h1>
        <p className="xp-lead">
          Responda no seu ritmo. Você pode pular perguntas. Nada é enviado ou
          guardado.
        </p>
      </header>
      <TasteQuiz taste={taste} coffees={coffees} />
    </div>
  );
}
