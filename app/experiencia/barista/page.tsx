import type { Metadata } from "next";
import { BaristaChat } from "../../../components/experience/barista-chat";
import { lessonIndex } from "../../../lib/experience/barista-tools";
import { getExperience } from "../../../lib/experience/content";
import { metadataFor } from "../../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Barista Cura | CURA Experience",
  "Tire dúvidas de preparo, moagem, proporção e degustação com o Barista Cura, da Cura Café.",
  "experiencia/barista/",
);

export default function BaristaPage() {
  const { knowledge, coffees, methods, diagnosis, taste, academy } =
    getExperience();
  return (
    <div className="wrap xp-page xp-barista-page">
      <header className="xp-page-head">
        <p className="eyebrow">BARISTA CURA</p>
        <h1>
          Pergunte <em>ao barista.</em>
        </h1>
        <p className="xp-lead">
          Receitas para o seu equipamento, ajustes de preparo, sabores e os
          cafés da Cura. Pergunte do seu jeito.
        </p>
      </header>
      <BaristaChat
        data={{
          knowledge,
          coffees,
          methods,
          diagnosis,
          taste,
          lessons: lessonIndex(academy),
        }}
      />
      <p className="xp-small xp-chat-note">
        {knowledge.disclaimer} A conversa fica só nesta aba do navegador; não
        guardamos o que você escreve.
      </p>
    </div>
  );
}
