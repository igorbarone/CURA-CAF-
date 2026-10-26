import { coffees } from "../lib/coffees";
export function CoffeeCard({ coffee }: { coffee: (typeof coffees)[number] }) {
  return (
    <article
      className={`coffee-card ${coffee.tone}`}
      aria-labelledby={`cafe-${coffee.lot}`}
    >
      <div className="coffee-art" aria-hidden="true">
        <span className="art-caption">
          ESTUDO GRÁFICO · NÃO É A EMBALAGEM FINAL
        </span>
        <div className="coffee-pack">
          <div className="pack-seal" />
          <span className="pack-brand">CURA CAFÉ</span>
          <span className="pack-signature">da roça à cidade.</span>
          <div className="pack-label">
            <span className="mono">{coffee.lot}</span>
            <strong>{coffee.name}</strong>
            <span>{coffee.notes}</span>
            <span className="pack-line" />
            <span className="mono">ENCONTRADO. ESCOLHIDO. EXPLICADO.</span>
          </div>
        </div>
        <span className="art-number">
          {coffee.score}
          <small>pontos SCAA</small>
        </span>
      </div>
      <div className="coffee-info">
        <p className="eyebrow">
          {coffee.lot} <span>Torra {coffee.roast.toLowerCase()}</span>
        </p>
        <h3 id={`cafe-${coffee.lot}`}>{coffee.name}</h3>
        <p className="coffee-notes">{coffee.notes}</p>
        <p className="body-copy">{coffee.description}</p>
        <dl>
          <div>
            <dt>Quem produz</dt>
            <dd>{coffee.producers}</dd>
          </div>
          <div>
            <dt>Na sua xícara</dt>
            <dd>{coffee.preparation}</dd>
          </div>
        </dl>
        <p className="availability">Preço e disponibilidade a confirmar.</p>
      </div>
    </article>
  );
}
