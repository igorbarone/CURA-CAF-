"use client";
import { useState } from "react";
import { Arrow } from "./arrow";
import Link from "next/link";
import { Header } from "./header";
import { Footer } from "./footer";
import { Breadcrumbs } from "./breadcrumbs";
import { CoffeeArt } from "./coffee-art";
import { CoffeeCard } from "./coffee-card";
import { CommerceStatus } from "./commerce-status";
import { projectCoffee, type CatalogEntry } from "../lib/catalog-model";
export function ProductDetail({
  entry,
  related,
}: {
  entry: CatalogEntry;
  related: CatalogEntry[];
}) {
  const [selectedLotId, setSelectedLotId] = useState(
    entry.coffee.primaryLotId ?? "",
  );
  const coffee = projectCoffee(entry, selectedLotId);
  return (
    <>
      <Header />
      <main className="wrap product-page" id="conteudo">
        <Breadcrumbs current={coffee.name} product />
        {entry.lots.length > 1 && (
          <div className="lot-selector">
            <label htmlFor="lot-select">Escolha o lote para conhecer</label>
            <select
              id="lot-select"
              value={coffee.lotId ?? ""}
              onChange={(event) => setSelectedLotId(event.target.value)}
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
              {coffee.score !== null && ` · ${coffee.score} PONTOS SCAA`}
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
            <CommerceStatus
              offers={entry.offers.filter(
                (offer) => offer.lotId === coffee.lotId,
              )}
            />
          </div>
        </section>
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
              <dt>Pontuação SCAA</dt>
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
      <Footer />
    </>
  );
}
