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
        <summary>O C da Cura · desenho oficial e direção</summary>
        <p>
          Três curvas de nível terminam em retas paralelas para a direita. É o
          desenho original da marca, extraído do manual de 26/10/2026.
        </p>
        <Image
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand/cura-logo.svg`}
          alt="Assinatura oficial Cura Café do manual de identidade"
          width={322}
          height={117}
        />
        <p className="mono">
          Desenho proprietário · nenhuma fonte substitui o logotipo
        </p>
      </details>
    </EditorialShell>
  );
}
