// A CSS viewport into the supplied artwork; no logo is redrawn or reconstructed.
export function BrandArt({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`official-brand ${large ? "official-brand-large" : ""}`}
      role="img"
      aria-label="Cura Café — da roça à cidade"
      style={{
        backgroundImage: `url(${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/media/cura-cafe-embalagem-branca-arte-frente-300dpi-v2.png)`,
      }}
    />
  );
}
