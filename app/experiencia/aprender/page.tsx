import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "../../../components/arrow";
import { getExperience } from "../../../lib/experience/content";
import { metadataFor } from "../../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Academia Cura | CURA Experience",
  "Aprenda sobre café especial: do básico à degustação e à ciência da extração, em linguagem simples.",
  "experiencia/aprender/",
);

export default function AcademyPage() {
  const { academy } = getExperience();
  return (
    <div className="wrap xp-page">
      <header className="xp-page-head">
        <p className="eyebrow">ACADEMIA CURA</p>
        <h1>
          Aprender café <em>é para todo mundo.</em>
        </h1>
        <p className="xp-lead">
          Conteúdo por nível de conhecimento. Comece por onde fizer sentido: não
          há ordem obrigatória.
        </p>
      </header>
      <ol className="xp-modules">
        {academy.modules.map((mod) => (
          <li key={mod.id}>
            <Link href={`/experiencia/aprender/${mod.id}/`} className="xp-mod">
              <span className="xp-mod-number mono">MÓDULO {mod.number}</span>
              <span className="xp-mod-level mono">{mod.level}</span>
              <span className="xp-mod-title">{mod.title}</span>
              <span>{mod.audience}</span>
              <span className="xp-mod-count mono">
                {mod.lessons.length}{" "}
                {mod.lessons.length === 1 ? "lição" : "lições"}
                {mod.interactive === "tasting" && " · roda sensorial"}
                {mod.interactive === "extraction" && " · simulador"}
              </span>
              <Arrow />
            </Link>
          </li>
        ))}
      </ol>
      <section className="xp-section xp-shortcuts" aria-labelledby="xp-explore">
        <h2 id="xp-explore" className="eyebrow">
          MAIS PARA EXPLORAR
        </h2>
        <ul>
          <li>
            <Link href="/experiencia/origem/">
              <span className="xp-shortcut-title">Da fazenda à xícara</span>
              <span>Terroir, colheita e níveis de torra.</span>
            </Link>
          </li>
          <li>
            <Link href="/experiencia/paladar/">
              <span className="xp-shortcut-title">Descubra seu paladar</span>
              <span>Seu perfil sensorial em seis perguntas.</span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
