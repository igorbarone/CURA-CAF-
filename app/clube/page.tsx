import { Arrow } from "../../components/arrow";
import { metadataFor } from "../../lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "../../components/editorial-shell";
import { getEditorial } from "../../lib/editorial";
export const metadata: Metadata = metadataFor(
  "Clube Cura — proposta futura | Cura Café",
  getEditorial().club.intro,
  "clube/",
);

export default function Club() {
  const { club } = getEditorial();
  return (
    <EditorialShell current="Clube Cura">
      <section className="editorial-hero club-hero">
        <p className="eyebrow">{club.eyebrow}</p>
        <h1>
          {club.title}
          <br />
          <em>{club.emphasis}</em>
        </h1>
        <p className="editorial-lead">{club.intro}</p>
        <span className="status-pill">Assinatura em desenvolvimento</span>
      </section>
      <section className="story-v1">
        <div className="editorial-prose">
          {club.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <Link className="button" href="/cafes/">
            Conheça os cafés da curadoria <Arrow />
          </Link>
        </div>
        <aside className="pending-panel">
          <p className="eyebrow">ANTES DE ABRIR AS ASSINATURAS</p>
          <h2>
            O cuidado também
            <br />
            está em <em>esperar.</em>
          </h2>
          <ul>
            {club.pendingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>Sem lista de espera, cobrança ou contratação nesta fase.</p>
        </aside>
      </section>
    </EditorialShell>
  );
}
