import Image from "next/image";
export function BrandArt({
  large = false,
  inverse = false,
}: {
  large?: boolean;
  inverse?: boolean;
}) {
  return (
    <Image
      className={`official-brand ${large ? "official-brand-large" : ""}`}
      src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand/${inverse ? "cura-logo-negativo" : "cura-logo"}.svg`}
      alt="Cura Café"
      width={322}
      height={117}
      priority={!large}
    />
  );
}
