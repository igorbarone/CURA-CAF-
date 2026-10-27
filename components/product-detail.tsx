"use client";
import { useEffect, useState } from "react";
import { Arrow } from "./arrow";
import Link from "next/link";
import { Breadcrumbs } from "./breadcrumbs";
import { CoffeeArt } from "./coffee-art";
import { CoffeeCard } from "./coffee-card";
import { CommerceStatus } from "./commerce-status";
import { projectCoffee, type CatalogEntry } from "../lib/catalog-model";
import type { ContactLink } from "../lib/contact";
export function ProductDetail({
  entry,
  related,
  contactByLot = {},
}: {
  entry: CatalogEntry;
  related: CatalogEntry[];
  contactByLot?: Record<string, ContactLink[]>;
}) {
  const [selectedLotId, setSelectedLotId] = useState(
    entry.coffee.primaryLotId ?? "",
  );
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("lote");
    if (requested && entry.lots.some((lot) => lot.id === requested))
      setSelectedLotId(requested);
  }, [entry.lots]);
  const coffee = projectCoffee(entry, selectedLotId);
  return (
    <>
      <main className="wrap product-page" id="conteudo">
        <Breadcrumbs current={coffee.name} product />
        {entry.lots.length > 1 && (
          <div className="lot-selector">
            <label htmlFor="lot-select">Escolha o lote para conhecer</label>
            <select
              id="lot-select"
              value={coffee.lotId ?? ""}
              onChange={(event) => {
                setSelectedLotId(event.target.value);
                const url = new URL(window.location.href);
                url.searchParams.set("lote", event.target.value);
                window.history.replaceState(null, "", url);
              }}
            >
              {entry.lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.code}
                </option>
              ))}
            </select>
            <p role="status" className="mono">
              Ficha do lote {coffee.lot}
            </p>
          </div>
        )}
        <section
          className={`product-hero ${coffee.tone}`}
          aria-labelledby="product-name"
        >
          <CoffeeArt coffee={coffee} />
          <div className="product-summary">
            <p className="eyebrow">
              {coffee.lot}
              {coffee.score !== null && ` · ${coffee.score} PONTOS SCA`}
            </p>
            <h1 id="product-name">
              {coffee.name}
              <span>{coffee.profile}</span>
            </h1>
            <p className="coffee-notes">{coffee.notes}</p>
            <p className="body-copy">{coffee.description}</p>
            <p className="product-roast mono">
              TORRA {coffee.roast.toUpperCase()} · {coffee.preparation}
            </p>
            <a className="producer-byline" href="#origem">
              <span className="eyebrow">QUEM ASSINA ESTE LOTE</span>
              <span>{coffee.producers}</span>
            </a>
            <CommerceStatus
              offers={entry.offers.filter(
                (offer) => offer.lotId === coffee.lotId,
              )}
              contact={contactByLot[coffee.lotId ?? ""] ?? []}
            />
          </div>
        </section>
        {coffee.curationNote && (
          <aside className="curator-note">
            <p className="eyebrow">POR QUE ESCOLHEMOS</p>
            <blockquote>{coffee.curationNote}</blockquote>
          </aside>
        )}
        <section className="product-details" aria-labelledby="sensory-title">
          <div>
            <p className="eyebrow">01 / NA XÍCARA</p>
            <h2 id="sensory-title">
              O sabor,
              <br />
              <em>sem complicação.</em>
            </h2>
            <p className="body-copy">
              Notas sensoriais descrevem lembranças de aroma e sabor do café.
              Não são ingredientes adicionados.
            </p>
          </div>
          <dl className="fact-grid">
            <div>
              <dt>Notas sensoriais</dt>
              <dd>{coffee.notes}</dd>
            </div>
            <div>
              <dt>Acidez</dt>
              <dd>{coffee.acidity ?? "Informação a confirmar"}</dd>
            </div>
            <div>
              <dt>Corpo</dt>
              <dd>{coffee.body ?? "Informação a confirmar"}</dd>
            </div>
            <div>
              <dt>Torra</dt>
              <dd>{coffee.roast}</dd>
            </div>
            <div>
              <dt>Pontuação SCA</dt>
              <dd>
                {coffee.score !== null
                  ? `${coffee.score} pontos`
                  : "Informação a confirmar"}
              </dd>
            </div>
            <div>
              <dt>Experimente no preparo</dt>
              <dd>{coffee.preparation}</dd>
            </div>
          </dl>
        </section>
        <section
          className="product-details origin-details"
          id="origem"
          aria-labelledby="origin-title"
        >
          <div>
            <p className="eyebrow">02 / QUEM ASSINA O CAFÉ</p>
            <h2 id="origin-title">
              Da origem,
              <br />
              <em>com respeito.</em>
            </h2>
          </div>
          <div>
            <p className="producer-name">{coffee.producers}</p>
            {coffee.producerStory && (
              <p className="producer-story">{coffee.producerStory}</p>
            )}
            <dl className="fact-grid">
              <div>
                <dt>Produtores</dt>
                <dd>{coffee.producers}</dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{coffee.origin}</dd>
              </div>
              <div>
                <dt>Variedade</dt>
                <dd>{coffee.variety ?? "Informação a confirmar"}</dd>
              </div>
              <div>
                <dt>Rastreabilidade</dt>
                <dd>{coffee.lot}</dd>
              </div>
            </dl>
            <p className="body-copy">
              Publicamos o que está confirmado. Município, altitude, safra e
              outros detalhes serão acrescentados após validação, sem preencher
              lacunas com suposições.
            </p>
          </div>
        </section>
        {related.length > 0 && (
          <section className="related-section" aria-labelledby="related-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CONTINUE A DESCOBERTA</p>
                <h2 id="related-title">
                  Outro jeito
                  <br />
                  de <em>sentir.</em>
                </h2>
              </div>
              <Link className="text-link" href="/cafes/">
                Ver todos os cafés{" "}
                <span aria-hidden="true">
                  <Arrow />
                </span>
              </Link>
            </div>
            <div className="coffee-grid">
              {related.map((item) => (
                <CoffeeCard key={item.coffee.id} coffee={projectCoffee(item)} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
