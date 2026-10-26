import { BrandArt } from "./brand-art";
import Link from "next/link";
import Image from "next/image";
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      className={`brand ${inverse ? "brand-inverse" : ""}`}
      href="/#inicio"
      aria-label="Cura Café — início"
    >
      <BrandArt inverse={inverse} />
    </Link>
  );
}
// The artwork is extracted from page 2 of the supplied manual, never redrawn.
export function Journey({ className = "" }: { className?: string }) {
  return (
    <Image
      className={`journey ${className}`}
      src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand/cura-simbolo.svg`}
      width={149}
      height={147}
      alt=""
      aria-hidden="true"
    />
  );
}
