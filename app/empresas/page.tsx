import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "../../components/arrow";
import { CoffeeCard } from "../../components/coffee-card";
import { getCatalog } from "../../lib/coffees";
import { projectCoffee } from "../../lib/catalog-model";
import { EditorialShell } from "../../components/editorial-shell";
import { EditorialTopics } from "../../components/editorial-topics";
import { getEditorial } from "../../lib/editorial";
import { metadataFor } from "../../lib/seo";
import { ContactLinks } from "../../components/contact-links";
import { contactLinks, getContact } from "../../lib/contact";

export const metadata: Metadata = metadataFor(
  "Para empresas — Food Service | Cura Café",
  getEditorial().business.intro,
  "empresas/",
);

export default function BusinessPage() {
  const { business } = getEditorial();
  const coffees = getCatalog();
  const contact = contactLinks(
    getContact(),
    "Olá, Cura Café! Quero conversar sobre servir Cura Café no meu estabelecimento.",
  );
  return (
    <EditorialShell current="Para empresas">
      <section
        className="editorial-hero business-hero"
        aria-labelledby="business-title"
      >
        <p className="eyebrow">{business.eyebrow}</p>
        <h1 id="business-title">
          {business.title}
          <br />
          <em>{business.emphasis}</em>
        </h1>
        <p className="editorial-lead">{business.intro}</p>
        <a
          href="#proxima-conversa"
          className="button"
          aria-describedby="business-channel-state"
        >
          {business.ctaLabel} <Arrow />
        </a>
        <p id="business-channel-state" className="business-channel-note">
          {contact.length
            ? "Conversa comercial direta com a equipe Cura."
            : "Canal de parceria em preparação."}
        </p>
      </section>
      <section className="business-segments" aria-labelledby="segments-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">01 / PARA QUEM É</p>
            <h2 id="segments-title">{business.segmentsTitle}</h2>
          </div>
          <p className="section-intro">{business.segmentsIntro}</p>
        </div>
        <EditorialTopics items={business.segments} />
      </section>
      <section
        className="business-section business-benefits"
        aria-labelledby="benefits-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">02 / A NOSSA PROPOSTA</p>
            <h2 id="benefits-title">{business.benefitsTitle}</h2>
          </div>
          <p className="section-intro">{business.benefitsIntro}</p>
        </div>
        <EditorialTopics items={business.benefits} />
      </section>
      <section
        className="business-section business-coffees"
        aria-labelledby="business-coffees-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">03 / A MESMA CURADORIA</p>
            <h2 id="business-coffees-title">{business.coffeesTitle}</h2>
          </div>
          <p className="section-intro">{business.coffeesIntro}</p>
        </div>
        {coffees.length ? (
          <div className="coffee-grid">
            {coffees.map((entry) => (
              <CoffeeCard key={entry.coffee.id} coffee={projectCoffee(entry)} />
            ))}
          </div>
        ) : (
          <p className="body-copy">{business.coffeesEmpty}</p>
        )}
      </section>
      <section
        className="business-purpose"
        aria-labelledby="business-purpose-title"
      >
        <p className="eyebrow">04 / MAIS GENTE NA CONVERSA</p>
        <h2 id="business-purpose-title">{business.purposeTitle}</h2>
        <p>{business.purposeText}</p>
      </section>
      <section
        className="business-next"
        id="proxima-conversa"
        aria-labelledby="next-title"
      >
        <div>
          <p className="eyebrow">
            {contact.length ? "VAMOS CONVERSAR" : "CANAL EM PREPARAÇÃO"}
          </p>
          <h2 id="next-title">{business.nextTitle}</h2>
        </div>
        <div>
          {contact.length ? (
            <>
              <p>
                Conte sobre o seu estabelecimento e o que procura no café. As
                condições são definidas na conversa comercial.
              </p>
              <ContactLinks
                links={contact}
                note="O contato abre um canal externo. Não cria pedido, reserva ou contrato."
              />
            </>
          ) : (
            <p>{business.nextText}</p>
          )}
          <details className="business-intake">
            <summary>
              {contact.length
                ? "O que ajuda na primeira conversa"
                : business.intakeTitle}
            </summary>
            <ul>
              {business.intakeItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
          <Link href="/cafes/" className="text-link">
            Enquanto isso, conheça os cafés <Arrow />
          </Link>
        </div>
      </section>
    </EditorialShell>
  );
}
