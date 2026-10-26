import Image from "next/image";
import { BrandArt } from "./brand-art";
import { mediaForLot, type CoffeeView } from "../lib/catalog-model";
export function CoffeeArt({ coffee }: { coffee: CoffeeView }) {
  // A label's printed facts belong to its explicit lot, not whichever lot is primary.
  const media = mediaForLot(coffee);
  if (media)
    return (
      <figure
        className={`coffee-art coffee-photo ${media.kind === "artwork" ? "official-label" : ""}`}
      >
        <Image
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${media.src}`}
          alt={media.alt}
          fill
          sizes="(max-width:640px) 100vw, 50vw"
        />
        <figcaption>
          {media.kind === "artwork" && (
            <strong>ARTE OFICIAL DE RÓTULO · </strong>
          )}
          {media.credit}
        </figcaption>
      </figure>
    );
  return (
    <div className="coffee-art coffee-placeholder" aria-hidden="true">
      <span className="art-caption">
        VISUAL EDITORIAL · IMAGEM DESTE LOTE PENDENTE
      </span>
      <div className="coffee-data-sheet">
        <BrandArt />
        <span className="mono">FICHA DE CURADORIA / {coffee.lot}</span>
        <strong>{coffee.name}</strong>
        <span className="sheet-notes">{coffee.notes}</span>
        <span className="sheet-rule" />
        <span className="mono">ENCONTRADO. ESCOLHIDO. EXPLICADO.</span>
      </div>
      {coffee.score !== null && (
        <span className="art-number">
          {coffee.score}
          <small>pontos SCA</small>
        </span>
      )}
    </div>
  );
}
