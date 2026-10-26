import Image from "next/image";
import type { CoffeeView } from "../lib/catalog-model";
export function CoffeeArt({ coffee }: { coffee: CoffeeView }) {
  if (coffee.media)
    return (
      <figure className="coffee-art coffee-photo">
        <Image
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${coffee.media.src}`}
          alt={coffee.media.alt}
          fill
          sizes="(max-width:640px) 100vw, 50vw"
        />
        <figcaption>{coffee.media.credit}</figcaption>
      </figure>
    );
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
      {coffee.score !== null && (
        <span className="art-number">
          {coffee.score}
          <small>pontos SCAA</small>
        </span>
      )}
    </div>
  );
}
