import type { Metadata } from "next";
import { BaristaChat } from "../../../components/experience/barista-chat";
import { getExperience } from "../../../lib/experience/content";
import { metadataFor } from "../../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Barista Cura | CURA Experience",
  "Tire dúvidas de preparo, moagem, proporção e degustação com o Barista Cura, assistente educativo da Cura Café.",
  "experiencia/barista/",
);

export default function BaristaPage() {
  const { knowledge, coffees, methods, diagnosis, taste } = getExperience();
  return (
    <div className="wrap xp-page">
      <header className="xp-page-head">
        <p className="eyebrow">BARISTA CURA</p>
        <h1>
          Pergunte <em>ao barista.</em>
        </h1>
        <p className="xp-lead">
          Preparo, moagem, receitas, sabores e os cafés da Cura. Respostas
          simples, sem pressa e sem diagnóstico apressado.
        </p>
      </header>
      <BaristaChat
        context={{ knowledge, coffees, methods, diagnosis, taste }}
      />
      <p className="xp-small xp-chat-note">{knowledge.disclaimer}</p>
    </div>
  );
}
