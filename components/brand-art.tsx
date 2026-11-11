import Image from "next/image";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Official vectors only. The transparent files are the same artwork with the
// background panel removed, so the mark sits on either theme without a box.
export function BrandArt({
  large = false,
  inverse = false,
}: {
  large?: boolean;
  inverse?: boolean;
}) {
  const className = `official-brand ${large ? "official-brand-large" : ""}`;
  if (inverse)
    return (
      <Image
        className={className}
        src={`${base}/brand/cura-logo-negativo-transparente.svg`}
        alt="Cura Café"
        width={120}
        height={48}
        priority={!large}
      />
    );
  // Follows the page theme: brown wordmark on cream, cream/ochre on black.
  return (
    <span className={`${className} themed-brand`}>
      <Image
        className="theme-light-only"
        src={`${base}/brand/cura-logo-transparente.svg`}
        alt="Cura Café"
        width={322}
        height={117}
        priority={!large}
      />
      <Image
        className="theme-black-only"
        src={`${base}/brand/cura-logo-negativo-transparente.svg`}
        alt=""
        aria-hidden="true"
        width={120}
        height={48}
        priority={!large}
      />
    </span>
  );
}
