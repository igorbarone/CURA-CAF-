import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "../../components/arrow";
import { ExperienceIntro } from "../../components/experience/experience-intro";
import { getExperience } from "../../lib/experience/content";
import { metadataFor } from "../../lib/seo";

const { journey } = getExperience();
export const metadata: Metadata = metadataFor(
  "CURA Experience | Cura Café",
  `${journey.intro.title} ${journey.intro.subtitle}`,
  "experiencia/",
);

// Permanent QR-code destination printed on every package. New coffees appear
// here from the catalogue, so the address never needs to change.
export default function ExperienceHome() {
  const { journey, coffees } = getExperience();
  return (
    <>
      <ExperienceIntro intro={journey.intro} coffees={coffees} />
      <section className="wrap xp-paths" aria-labelledby="xp-paths-title">
        <p className="eyebrow">EXPLORE NO SEU RITMO</p>
        <h2 id="xp-paths-title">
          Três caminhos. <em>Escolha o seu.</em>
        </h2>
        <ol className="xp-path-list">
          {journey.intro.paths.map((path, index) => (
            <li key={path.id}>
              <Link className="xp-path" href={path.href}>
                <span className="xp-path-number mono">0{index + 1}</span>
                <span className="xp-path-title">{path.title}</span>
                <span className="xp-path-text">{path.text}</span>
                <span className="xp-path-go" aria-hidden="true">
                  <Arrow />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <section
        className="wrap xp-section xp-shortcuts"
        aria-labelledby="xp-more"
      >
        <h2 id="xp-more" className="eyebrow">
          TAMBÉM PARA VOCÊ
        </h2>
        <ul>
          <li>
            <Link href="/experiencia/minha-jornada/">
              <span className="xp-shortcut-title">Minha jornada</span>
              <span>
                Receitas salvas e o histórico dos seus preparos, neste
                navegador.
              </span>
              <Arrow />
            </Link>
          </li>
          <li>
            <Link href="/experiencia/paladar/">
              <span className="xp-shortcut-title">Descubra seu paladar</span>
              <span>Seis perguntas para encontrar o seu perfil sensorial.</span>
              <Arrow />
            </Link>
          </li>
          <li>
            <Link href="/experiencia/barista/">
              <span className="xp-shortcut-title">
                Pergunte ao Barista Cura
              </span>
              <span>Receitas, ajustes de preparo e dúvidas sobre café.</span>
              <Arrow />
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
