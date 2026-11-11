import type { Metadata } from "next";
import Link from "next/link";
import { OriginJourney } from "../../../components/experience/origin-journey";
import { getExperience } from "../../../lib/experience/content";
import { metadataFor } from "../../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Da fazenda à xícara | CURA Experience",
  "Terroir, produtor, colheita, torra e xícara: a jornada de cada grão de café, explicada de forma simples.",
  "experiencia/origem/",
);

export default function OriginPage() {
  const { journey, coffees } = getExperience();
  return (
    <div className="wrap xp-page">
      <header className="xp-page-head">
        <p className="eyebrow">EXPLORAR O UNIVERSO DO CAFÉ</p>
        <h1>
          Da fazenda <em>à xícara.</em>
        </h1>
        <p className="xp-lead">
          Cinco etapas para entender de onde vem o sabor do café. Quer ver a
          jornada com os dados do seu café?{" "}
          {coffees.map((coffee, index) => (
            <span key={coffee.id}>
              {index > 0 && (index === coffees.length - 1 ? " ou " : ", ")}
              <Link
                className="xp-text-link"
                href={`/experiencia/cafes/${coffee.slug}/#terra`}
              >
                {coffee.name}
              </Link>
            </span>
          ))}
          .
        </p>
      </header>
      <OriginJourney journey={journey} />
      <section className="xp-section xp-shortcuts" aria-labelledby="xp-next">
        <h2 id="xp-next" className="eyebrow">
          CONTINUE EXPLORANDO
        </h2>
        <ul>
          <li>
            <Link href="/experiencia/aprender/">
              <span className="xp-shortcut-title">Academia Cura</span>
              <span>Três módulos, do básico à ciência do café.</span>
            </Link>
          </li>
          <li>
            <Link href="/experiencia/paladar/">
              <span className="xp-shortcut-title">Descubra seu paladar</span>
              <span>Um quiz para encontrar seu perfil e seu café.</span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
