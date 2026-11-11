import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arrow } from "../../../../components/arrow";
import { CoffeeMedia } from "../../../../components/experience/coffee-media";
import {
  CoffeeFacts,
  CoffeePicker,
} from "../../../../components/experience/coffee-picker";
import { SensoryProfile } from "../../../../components/experience/sensory-profile";
import { OriginJourney } from "../../../../components/experience/origin-journey";
import { ProductCta } from "../../../../components/experience/product-cta";
import { RememberCoffee } from "../../../../components/experience/remember-coffee";
import { EMPTY_CATALOG_ROUTE } from "../../../../lib/catalog-model";
import { methodFit } from "../../../../lib/experience/brew";
import type { ExperienceCoffee } from "../../../../lib/experience/coffee";
import {
  getExperience,
  getExperienceCoffees,
} from "../../../../lib/experience/content";
import type { Academy } from "../../../../lib/experience/schema";
import { metadataFor } from "../../../../lib/seo";

export const dynamicParams = false;
export function generateStaticParams() {
  const routes = getExperienceCoffees().map(({ slug }) => ({ slug }));
  return routes.length ? routes : [{ slug: EMPTY_CATALOG_ROUTE }];
}
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = getExperienceCoffees().find((item) => item.slug === slug);
  if (!found) return { robots: { index: false } };
  return metadataFor(
    `${found.name} | CURA Experience`,
    `Origem, perfil sensorial e como preparar o ${found.name}. ${found.description}`,
    `experiencia/cafes/${found.slug}/`,
  );
}

/** Lessons suggested by the coffee's own published attributes. */
function lessonsFor(coffee: ExperienceCoffee, academy: Academy) {
  const ids = [
    coffee.score !== undefined
      ? "o-que-significam-os-pontos"
      : "tradicional-gourmet-especial",
    coffee.sensory?.acidity && /c[ií]tric|alta/i.test(coffee.sensory.acidity)
      ? "acidez-ou-azedume"
      : null,
    coffee.sensory?.notes?.some((note) =>
      /rapadura|melaço|caramel|mel\b/i.test(note),
    )
      ? "por-que-parecem-doces"
      : null,
    coffee.process ? "processamentos" : null,
    coffee.formats.includes("Em grãos") ? "graos-ou-moido" : "como-conservar",
  ].filter(Boolean) as string[];
  return academy.modules.flatMap((module) =>
    module.lessons
      .filter((lesson) => ids.includes(lesson.id))
      .map((lesson) => ({ module, lesson })),
  );
}

export default async function CoffeeExperiencePage({ params }: Props) {
  const { slug } = await params;
  const { coffees, journey, methods, academy } = getExperience();
  const coffee = coffees.find((item) => item.slug === slug);
  if (!coffee) notFound();
  const suggested = methods.filter(
    (method) => methodFit(method, coffee) === "label",
  );
  const others = methods.filter(
    (method) => methodFit(method, coffee) !== "label",
  );
  const lessons = lessonsFor(coffee, academy);
  return (
    <div className={`xp-coffee ${coffee.tone}`}>
      <RememberCoffee slug={coffee.slug} />
      <section className="wrap xp-coffee-hero" aria-labelledby="coffee-title">
        <div className="xp-coffee-hero-media">
          <CoffeeMedia
            coffee={coffee}
            priority
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </div>
        <div className="xp-coffee-hero-copy">
          <p className="eyebrow">
            MEU CAFÉ{coffee.lotCode ? ` · ${coffee.lotCode}` : ""}
          </p>
          <h1 id="coffee-title">{coffee.name}</h1>
          <CoffeeFacts coffee={coffee} />
          {coffee.score !== undefined && (
            <p className="xp-score">
              <span className="xp-score-value">{coffee.score}</span>
              <span className="mono">PONTOS SCA</span>
              <Link
                href="/experiencia/aprender/cafe-sem-complicacao/#o-que-significam-os-pontos"
                className="xp-text-link"
              >
                O que significa?
              </Link>
            </p>
          )}
          <p className="xp-lead">{coffee.description}</p>
          <SensoryProfile coffee={coffee} />
          <div className="xp-hero-actions">
            <Link
              className="button"
              href={`/experiencia/preparar/?cafe=${coffee.slug}`}
            >
              Preparar este café <Arrow />
            </Link>
            <a className="xp-text-link" href="#terra">
              Conhecer a origem
            </a>
          </div>
        </div>
      </section>

      <section className="wrap xp-section" aria-labelledby="brew-title">
        <div className="xp-section-head">
          <p className="eyebrow">RECOMENDAÇÕES DE PREPARO</p>
          <h2 id="brew-title">
            Como preparar <em>o {coffee.name}.</em>
          </h2>
          {coffee.formats.includes("Em grãos") && (
            <p className="xp-lead">
              Seu café vem em grãos: moa na hora, na moagem indicada para o
              método. É o maior ganho de sabor com o menor esforço.
            </p>
          )}
        </div>
        {suggested.length > 0 && (
          <>
            <h3 className="eyebrow">SUGERIDOS NO RÓTULO</h3>
            <ul className="xp-method-links">
              {suggested.map((method) => (
                <li key={method.id}>
                  <Link
                    href={`/experiencia/preparar/?cafe=${coffee.slug}&metodo=${method.id}`}
                  >
                    <strong>{method.name}</strong>
                    <span>{method.summary}</span>
                    <Arrow />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <h3 className="eyebrow">
          {suggested.length ? "PARA EXPERIMENTAR" : "ESCOLHA SEU MÉTODO"}
        </h3>
        <ul className="xp-method-links is-compact">
          {others.map((method) => (
            <li key={method.id}>
              <Link
                href={`/experiencia/preparar/?cafe=${coffee.slug}&metodo=${method.id}`}
              >
                <strong>{method.name}</strong>
                <Arrow />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="wrap">
        <OriginJourney journey={journey} coffee={coffee} />
      </div>

      {lessons.length > 0 && (
        <section className="wrap xp-section" aria-labelledby="learn-title">
          <div className="xp-section-head">
            <p className="eyebrow">PARA ENTENDER SEU CAFÉ</p>
            <h2 id="learn-title">
              O que o rótulo <em>está dizendo.</em>
            </h2>
          </div>
          <ul className="xp-lesson-links">
            {lessons.map(({ module, lesson }) => (
              <li key={lesson.id}>
                <Link href={`/experiencia/aprender/${module.id}/#${lesson.id}`}>
                  <span className="mono">{module.title}</span>
                  <strong>{lesson.title}</strong>
                  <span>{lesson.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        className="wrap xp-section xp-commerce"
        aria-labelledby="buy-title"
      >
        <div>
          <p className="eyebrow">GOSTOU DESTE CAFÉ?</p>
          <h2 id="buy-title">
            Compre novamente <em>ou descubra outro perfil.</em>
          </h2>
          <div className="xp-hero-actions">
            <ProductCta coffee={coffee} context="cafe-experiencia" />
            <Link className="xp-text-link" href="/experiencia/paladar/">
              Encontre o café ideal para você
            </Link>
          </div>
        </div>
      </section>

      {coffees.length > 1 && (
        <section className="wrap xp-section" aria-labelledby="switch-title">
          <h2 id="switch-title" className="eyebrow">
            TROCAR DE CAFÉ
          </h2>
          <CoffeePicker coffees={coffees} current={coffee.slug} />
        </section>
      )}
    </div>
  );
}
