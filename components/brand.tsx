import { BrandArt } from "./brand-art";
import Link from "next/link";
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      className={`brand ${inverse ? "brand-inverse" : ""}`}
      href="/#inicio"
      aria-label="Cura Café — início"
    >
      <CuraMark className="brand-mark" />
      <BrandArt inverse={inverse} />
    </Link>
  );
}
// The official C symbol (manual, page 2), drawn from its vector as a mask so
// it takes the current text colour in both themes. Never redrawn.
const markUrl = `url(${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand/cura-simbolo-transparente.svg)`;
export function CuraMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`cura-mark ${className}`}
      style={{ "--mark": markUrl } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}
export function Journey({ className = "" }: { className?: string }) {
  return <CuraMark className={`journey ${className}`} />;
}
