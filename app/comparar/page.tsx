import { metadataFor } from "../../lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "../../components/arrow";
import { EditorialShell } from "../../components/editorial-shell";
import { Comparator } from "../../components/comparator";
import { getCatalog } from "../../lib/coffees";
export const metadata: Metadata = metadataFor(
  "Compare cafés | Cura Café",
  "Coloque lado a lado perfil, notas, pontuação SCA, torra, preparo e quem produz cada café da curadoria.",
  "comparar/",
);

export default function ComparePage() {
  return (
    <EditorialShell current="Compare cafés">
      <section className="editorial-hero">
        <p className="eyebrow">LADO A LADO</p>
        <h1>
          Compare
          <br />
          <em>e escolha.</em>
        </h1>
        <p className="editorial-lead">
          Veja os perfis da nossa curadoria lado a lado: notas, torra, pontuação
          e quem produz. Ainda em dúvida?{" "}
          <Link className="text-link" href="/descubra/">
            Responda o quiz <Arrow />
          </Link>
        </p>
      </section>
      <Comparator entries={getCatalog()} />
    </EditorialShell>
  );
}
