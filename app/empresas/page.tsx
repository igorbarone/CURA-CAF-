import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "../../components/arrow";
import { EditorialShell } from "../../components/editorial-shell";
import { EditorialTopics } from "../../components/editorial-topics";
import { getEditorial } from "../../lib/editorial";
import { metadataFor } from "../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Para empresas | Cura Café",
  getEditorial().business.intro,
  "empresas/",
);

export default function BusinessPage() {
  const { business } = getEditorial();
  return (
    <EditorialShell current="Para empresas">
      <section
        className="editorial-hero business-hero"
        aria-labelledby="business-title"
      >
        <p className="eyebrow">{business.eyebrow}</p>
        <h1 id="business-title">
          {business.title}
          <br />
          <em>{business.emphasis}</em>
        </h1>
        <p className="editorial-lead">{business.intro}</p>
        <a href="#proxima-conversa" className="text-link">
          Conheça a proposta <Arrow />
        </a>
      </section>
      <section className="business-segments" aria-labelledby="segments-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CONTEXTOS PARA CONSTRUIR JUNTOS</p>
            <h2 id="segments-title">{business.segmentsTitle}</h2>
          </div>
          <p className="section-intro">{business.segmentsIntro}</p>
        </div>
        <EditorialTopics items={business.segments} />
      </section>
      <section
        className="business-next"
        id="proxima-conversa"
        aria-labelledby="next-title"
      >
        <div>
          <p className="eyebrow">CANAL EM PREPARAÇÃO</p>
          <h2 id="next-title">{business.nextTitle}</h2>
        </div>
        <div>
          <p>{business.nextText}</p>
          <Link href="/cafes/" className="text-link">
            Enquanto isso, conheça os cafés <Arrow />
          </Link>
        </div>
      </section>
    </EditorialShell>
  );
}
