import Image from "next/image";
import type { SellableItem } from "../../lib/commerce/catalog";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Small package image for the buying flow; nothing when none is published.
export function PackThumb({
  item,
  size = 64,
}: {
  item: SellableItem;
  size?: number;
}) {
  if (!item.image) return null;
  return (
    <Image
      className="pack-thumb"
      src={`${base}${item.image.src}`}
      alt=""
      width={size}
      height={Math.round(size * 1.25)}
    />
  );
}
