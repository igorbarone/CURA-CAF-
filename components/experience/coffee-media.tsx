import Image from "next/image";
import type { ExperienceCoffee } from "../../lib/experience/coffee";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const mediaBadge: Record<string, string> = {
  photograph: "Foto",
  artwork: "Arte do rótulo",
  illustration: "Ilustração digital",
};

/** Package image with its mandatory nature badge (never shown as a photo). */
export function CoffeeMedia({
  coffee,
  priority = false,
  sizes = "(max-width: 760px) 100vw, 33vw",
  index = 0,
}: {
  coffee: ExperienceCoffee;
  priority?: boolean;
  sizes?: string;
  index?: number;
}) {
  const media = coffee.images[index] ?? coffee.images[0];
  if (!media)
    return (
      <div
        className={`xp-media xp-media-empty ${coffee.tone}`}
        aria-hidden="true"
      >
        <span>{coffee.name}</span>
      </div>
    );
  return (
    <figure className={`xp-media xp-media-${media.kind}`}>
      <Image
        src={`${base}${media.src}`}
        alt={media.alt}
        fill
        sizes={sizes}
        priority={priority}
      />
      <span className="xp-media-badge mono">{mediaBadge[media.kind]}</span>
    </figure>
  );
}
