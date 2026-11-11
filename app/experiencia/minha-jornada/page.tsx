import type { Metadata } from "next";
import { JourneyView } from "../../../components/experience/journey-view";
import { getExperience } from "../../../lib/experience/content";
import { metadataFor } from "../../../lib/seo";

export const metadata: Metadata = metadataFor(
  "Minha jornada | CURA Experience",
  "Suas receitas salvas, o diário de preparos e sugestões para a próxima xícara, guardados só neste navegador.",
  "experiencia/minha-jornada/",
);

export default function JourneyPage() {
  const { coffees, methods, diagnosis, taste } = getExperience();
  return (
    <div className="wrap xp-page">
      <header className="xp-page-head">
        <p className="eyebrow">MINHA JORNADA NO CAFÉ</p>
        <h1>
          Suas receitas, <em>seus preparos.</em>
        </h1>
        <p className="xp-lead">
          Volte quando quiser para repetir uma receita ou ajustar a próxima.
        </p>
      </header>
      <JourneyView
        coffees={coffees}
        methods={methods}
        diagnosis={diagnosis}
        taste={taste}
      />
    </div>
  );
}
