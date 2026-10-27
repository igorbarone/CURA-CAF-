// Client-safe helpers for the coffee comparator. No catalog data is stored
// here; components pass the public projections built at export time.
export const MAX_COMPARE = 3;
// Same four-step scale printed on the official labels (clara = 1, média = 2).
const ROAST_LEVELS: Record<string, number> = {
  clara: 1,
  "média clara": 1,
  média: 2,
  "média escura": 3,
  escura: 4,
};
export function roastLevel(roast: string | null) {
  if (!roast) return null;
  const key = roast.toLocaleLowerCase("pt-BR").replace(/-/g, " ").trim();
  return ROAST_LEVELS[key] ?? null;
}
// Keeps valid, unique slugs in the order given, capped at MAX_COMPARE.
export function parseCompareSlugs(
  value: string | null | undefined,
  validSlugs: string[],
) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((slug) => slug.trim())
        .filter((slug) => validSlugs.includes(slug)),
    ),
  ].slice(0, MAX_COMPARE);
}
export function comparePath(slugs: string[]) {
  return slugs.length
    ? `/comparar/?cafes=${slugs.map(encodeURIComponent).join(",")}`
    : "/comparar/";
}
