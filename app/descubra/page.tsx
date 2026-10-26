import { metadataFor } from "../../lib/seo";
import type { Metadata } from "next";
import { EditorialShell } from "../../components/editorial-shell";
import { CoffeeQuiz } from "../../components/coffee-quiz";
import { getCatalog } from "../../lib/coffees";
import { getEditorial } from "../../lib/editorial";
export const metadata: Metadata = metadataFor(
  "Descubra seu café | Cura Café",
  getEditorial().quiz.intro,
  "descubra/",
);

export default function Discover() {
  const { quiz } = getEditorial();
  return (
    <EditorialShell current="Descubra seu café">
      <section className="editorial-hero">
        <p className="eyebrow">{quiz.eyebrow}</p>
        <h1>
          {quiz.title}
          <br />
          <em>{quiz.emphasis}</em>
        </h1>
        <p className="editorial-lead">{quiz.intro}</p>
      </section>
      <CoffeeQuiz entries={getCatalog()} copy={quiz} />
    </EditorialShell>
  );
}
