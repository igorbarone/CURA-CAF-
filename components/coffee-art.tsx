import Image from "next/image";
import { BrandArt } from "./brand-art";
import type { CoffeeView } from "../lib/catalog-model";
export function CoffeeArt({ coffee }: { coffee: CoffeeView }) {
  if (coffee.media)
    return (
      <figure
        className={`coffee-art coffee-photo ${coffee.media.kind === "artwork" ? "official-label" : ""}`}
      >
        <Image
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${coffee.media.src}`}
          alt={coffee.media.alt}
          fill
          sizes="(max-width:640px) 100vw, 50vw"
        />
        <figcaption>
          {coffee.media.kind === "artwork" && (
            <strong>ARTE OFICIAL DE RÓTULO · </strong>
          )}
          {coffee.media.credit}
        </figcaption>
      </figure>
    );
  return (
    <div className="coffee-art coffee-placeholder" aria-hidden="true">
      <span className="art-caption">
        VISUAL EDITORIAL · FOTO OFICIAL DESTE CAFÉ PENDENTE
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
