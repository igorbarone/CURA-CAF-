import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "../../components/arrow";
import { ExperienceIntro } from "../../components/experience/experience-intro";
import { CoffeePicker } from "../../components/experience/coffee-picker";
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
      <ExperienceIntro intro={journey.intro} />
      <section className="wrap xp-section" aria-labelledby="xp-which">
        <div className="xp-section-head">
          <p className="eyebrow">CONHECER MEU CAFÉ</p>
          <h2 id="xp-which">
            Qual café está <em>na sua mão?</em>
          </h2>
          <p className="xp-lead">
            Toque no seu café para conhecer a origem, quem produz, o perfil
            sensorial e a melhor forma de preparar.
          </p>
        </div>
        <CoffeePicker coffees={coffees} />
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
            <Link href="/experiencia/paladar/">
              <span className="xp-shortcut-title">Descubra seu paladar</span>
              <span>Seis perguntas para encontrar o seu perfil sensorial.</span>
              <Arrow />
            </Link>
          </li>
          <li>
            <Link href="/experiencia/aprender/">
              <span className="xp-shortcut-title">Academia Cura</span>
              <span>Do básico à ciência da extração, sem complicação.</span>
              <Arrow />
            </Link>
          </li>
          <li>
            <Link href="/experiencia/barista/">
              <span className="xp-shortcut-title">
                Pergunte ao Barista Cura
              </span>
              <span>Dúvidas de preparo, moagem e ajuste de receita.</span>
              <Arrow />
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
