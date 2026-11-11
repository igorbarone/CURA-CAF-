import Image from "next/image";
import { CoffeeArt } from "./coffee-art";
import { mediaForLot, type CoffeeView } from "../lib/catalog-model";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const badge = {
  photograph: "Foto",
  artwork: "Arte do rótulo",
  illustration: "Ilustração digital",
} as const;
// Shop card image: the package up front; on hover/focus the official label
// (first gallery image) slides in so the printed facts can be read.
export function CardMedia({ coffee }: { coffee: CoffeeView }) {
  const media = mediaForLot(coffee);
  if (!media) return <CoffeeArt coffee={coffee} />;
  const back = coffee.gallery[0] ?? null;
  return (
    <div
      className={`card-media ${back ? "has-back" : ""} card-media-${media.kind}`}
    >
      <Image
        className="card-media-front"
        src={`${base}${media.src}`}
        alt={media.alt}
        fill
        sizes="(max-width: 640px) 100vw, 33vw"
      />
      {back && (
        <Image
          className="card-media-back"
          src={`${base}${back.src}`}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
        />
      )}
      <span className="card-media-badge mono">{badge[media.kind]}</span>
      {back && (
        <span className="card-media-hint mono" aria-hidden="true">
          Ver rótulo
        </span>
      )}
    </div>
  );
}
