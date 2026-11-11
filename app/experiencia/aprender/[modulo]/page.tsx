import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow } from "../../../../components/arrow";
import {
  LessonTracker,
  ModuleInteractive,
} from "../../../../components/experience/module-interactive";
import { getExperience } from "../../../../lib/experience/content";
import { loadExperience } from "../../../../lib/experience/content";
import { metadataFor } from "../../../../lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return loadExperience().academy.modules.map((mod) => ({ modulo: mod.id }));
}
type Props = { params: Promise<{ modulo: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modulo } = await params;
  const mod = loadExperience().academy.modules.find(
    (item) => item.id === modulo,
  );
  if (!mod) return {};
  return metadataFor(
    `${mod.title} | Academia Cura`,
    `${mod.audience} ${mod.intro}`,
    `experiencia/aprender/${mod.id}/`,
  );
}

export default async function ModulePage({ params }: Props) {
  const { modulo } = await params;
  const { academy, coffees } = getExperience();
  const index = academy.modules.findIndex((item) => item.id === modulo);
  const mod = academy.modules[index];
  if (!mod) notFound();
  const next = academy.modules[index + 1];
  return (
    <div className="wrap xp-page">
      <LessonTracker id={mod.id} />
      <nav className="xp-crumbs mono" aria-label="Caminho">
        <Link href="/experiencia/aprender/">Academia Cura</Link>{" "}
        <span aria-hidden="true">/</span>{" "}
        <span aria-current="page">Módulo {mod.number}</span>
      </nav>
      <header className="xp-page-head">
        <p className="eyebrow">
          MÓDULO {mod.number} · {mod.level.toLocaleUpperCase("pt-BR")}
        </p>
        <h1>{mod.title}</h1>
        <p className="xp-lead">{mod.intro}</p>
      </header>
      <div className="xp-module-layout">
        <nav className="xp-toc" aria-label="Lições do módulo">
          <p className="eyebrow">NESTE MÓDULO</p>
          <ol>
            {mod.lessons.map((lesson) => (
              <li key={lesson.id}>
                <a href={`#${lesson.id}`}>{lesson.title}</a>
              </li>
            ))}
            {mod.interactive !== "none" && (
              <li>
                <a href="#pratica">
                  {mod.interactive === "tasting"
                    ? "Roda sensorial"
                    : "Simulador de extração"}
                </a>
              </li>
            )}
          </ol>
        </nav>
        <div className="xp-lessons">
          {mod.lessons.map((lesson, i) => (
            <article
              key={lesson.id}
              id={lesson.id}
              className="xp-lesson"
              aria-labelledby={`${lesson.id}-t`}
            >
              <p className="mono xp-lesson-number">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 id={`${lesson.id}-t`}>{lesson.title}</h2>
              <p className="xp-lesson-summary">
                <em>{lesson.summary}</em>
              </p>
              {lesson.body.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
              {lesson.example && (
                <p className="xp-callout">
                  <strong>No dia a dia:</strong> {lesson.example}
                </p>
              )}
              {lesson.keyIdea && (
                <p className="xp-key mono">{lesson.keyIdea}</p>
              )}
            </article>
          ))}
          {mod.interactive !== "none" && (
            <section
              id="pratica"
              className="xp-lesson xp-practice"
              aria-labelledby="pratica-t"
            >
              <p className="mono xp-lesson-number">PRÁTICA</p>
              <h2 id="pratica-t">
                {mod.interactive === "tasting"
                  ? "Roda sensorial"
                  : "Simulador de extração"}
              </h2>
              <ModuleInteractive
                kind={mod.interactive}
                attributes={academy.attributes}
                coffees={coffees.map(({ slug, name }) => ({ slug, name }))}
              />
            </section>
          )}
          <p className="xp-ask-barista">
            Ficou alguma dúvida?{" "}
            <Link className="xp-text-link" href="/experiencia/barista/">
              Pergunte ao Barista Cura
            </Link>
          </p>
          <div className="xp-module-next">
            {next ? (
              <Link
                className="button"
                href={`/experiencia/aprender/${next.id}/`}
              >
                Próximo: {next.title} <Arrow />
              </Link>
            ) : (
              <Link className="button" href="/experiencia/preparar/">
                Coloque em prática no Laboratório <Arrow />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
