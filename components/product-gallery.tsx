"use client";
import Image from "next/image";
import { useState } from "react";
import { CoffeeArt } from "./coffee-art";
import type { CoffeeView } from "../lib/catalog-model";
// Main image (label/photo bound to the lot, via CoffeeArt) plus the CMS
// gallery. Without gallery items it is exactly the previous single image.
export function ProductGallery({ coffee }: { coffee: CoffeeView }) {
  const [index, setIndex] = useState(0);
  if (!coffee.gallery.length) return <CoffeeArt coffee={coffee} />;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const current = index > 0 ? coffee.gallery[index - 1] : null;
  return (
    <div className="product-gallery">
      {current ? (
        <figure className="coffee-art coffee-photo">
          <Image
            src={`${base}${current.src}`}
            alt={current.alt}
            fill
            sizes="(max-width:640px) 100vw, 50vw"
          />
          <figcaption>
            {current.kind === "artwork" && <strong>ARTE OFICIAL · </strong>}
            {current.credit}
          </figcaption>
        </figure>
      ) : (
        <CoffeeArt coffee={coffee} />
      )}
      <ul className="gallery-thumbs" aria-label="Fotos do produto">
        <li>
          <button
            type="button"
            aria-pressed={index === 0}
            onClick={() => setIndex(0)}
          >
            Imagem principal
          </button>
        </li>
        {coffee.gallery.map((item, position) => (
          <li key={item.src}>
            <button
              type="button"
              aria-pressed={index === position + 1}
              onClick={() => setIndex(position + 1)}
              aria-label={`Ver foto ${position + 2}: ${item.alt}`}
            >
              <Image src={`${base}${item.src}`} alt="" width={72} height={72} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
