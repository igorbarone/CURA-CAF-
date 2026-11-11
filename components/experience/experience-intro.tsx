import { CuraMark } from "../brand";
import { PackagePicker } from "./package-picker";
import type { ExperienceCoffee } from "../../lib/experience/coffee";
import type { Journey } from "../../lib/experience/schema";

/**
 * Opening. The brand message stays, but the first action is recognising the
 * package in hand; the three exploration paths follow below. Motion is CSS
 * only and is disabled by prefers-reduced-motion.
 */
export function ExperienceIntro({
  intro,
  coffees,
}: {
  intro: Journey["intro"];
  coffees: ExperienceCoffee[];
}) {
  return (
    <section className="xp-opening xp-dark" aria-labelledby="xp-title">
      <div className="xp-opening-art" aria-hidden="true">
        <CuraMark className="xp-opening-mark" />
        <span className="xp-opening-line xp-line-1" />
        <span className="xp-opening-line xp-line-2" />
        <span className="xp-opening-line xp-line-3" />
      </div>
      <div className="wrap xp-opening-copy">
        <p className="eyebrow">{intro.eyebrow}</p>
        <h1 id="xp-title">{intro.title}</h1>
        <p className="xp-opening-sub">
          <em>{intro.subtitle}</em>
        </p>
        <p className="xp-opening-ask">Qual café está na sua mão?</p>
        <PackagePicker coffees={coffees} />
        <p className="xp-opening-foot mono">
          Sem cadastro · Explore no seu ritmo
        </p>
      </div>
    </section>
  );
}
