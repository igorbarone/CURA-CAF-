import type { Coffee } from "../lib/coffees";
export function CoffeeArt({ coffee }: { coffee: Coffee }) {
  return (
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
  );
}
