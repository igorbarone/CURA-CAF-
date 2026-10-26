import { Arrow } from "../../components/arrow";
import { metadataFor } from "../../lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { EditorialShell } from "../../components/editorial-shell";
import { Journey } from "../../components/brand";
import { getEditorial } from "../../lib/editorial";
export const metadata: Metadata = metadataFor(
  "Nossa história | Cura Café",
  getEditorial().story.intro,
  "historia/",
);

export default function History() {
  const { story } = getEditorial();
  return (
    <EditorialShell current="Nossa história">
      <section className="editorial-hero">
        <p className="eyebrow">{story.eyebrow}</p>
        <h1>
          {story.title}
          <br />
          <em>{story.emphasis}</em>
        </h1>
        <p className="editorial-lead">{story.intro}</p>
      </section>
      <div className="story-v1">
        <div className="story-drawing">
          <Journey />
          <p>
            Da roça
            <br />
            <em>à cidade.</em>
          </p>
          <span className="mono">O PRODUTOR ASSINA O CAFÉ.</span>
        </div>
        <div className="editorial-prose">
          {story.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <Link className="button" href="/cafes/">
            Conheça a nossa seleção <Arrow />
          </Link>
        </div>
      </div>
      <details className="identity-reference">
        <summary>Um olhar sobre a identidade · estudo conceitual</summary>
        <p>
          Referência oficial de identidade. Os nomes ilustrados são conceituais,
          não produtos cadastrados. Não é uma fotografia de produtos
          disponíveis.
        </p>
        <Image
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/media/cura-cafe-video-referencia-prateleira-9x16.png`}
          alt="Estudo de prateleira da Cura com embalagens conceituais, fora do catálogo real"
          width={540}
          height={960}
          loading="lazy"
        />
        <p className="mono">
          Material fornecido pela Cura Café · referência visual
        </p>
      </details>
    </EditorialShell>
  );
}
