import type { CoffeeEntity, Content, Lot, Offer } from "./content-schema";
export type CatalogEntry = {
  coffee: CoffeeEntity;
  lots: Lot[];
  offers: Offer[];
};
const ordered = <T extends { sortOrder: number; id: string }>(items: T[]) =>
  [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
export function publicEntry(
  content: Content,
  coffee: CoffeeEntity,
): CatalogEntry {
  // An archived coffee retains a URL, but never exposes lot/offer data.
  const lots =
    coffee.status === "published"
      ? ordered(
          content.lots.filter(
            (lot) => lot.coffeeId === coffee.id && lot.status === "published",
          ),
        )
      : [];
  const offers = content.offers.filter(
    (offer) =>
      offer.status === "published" &&
      lots.some((lot) => lot.id === offer.lotId),
  );
  return { coffee, lots, offers };
}
export function publishedCatalog(content: Content): CatalogEntry[] {
  return ordered(
    content.coffees.filter((coffee) => coffee.status === "published"),
  ).map((coffee) => publicEntry(content, coffee));
}
export function publicProduct(
  content: Content,
  slug: string,
): CatalogEntry | undefined {
  const coffee = content.coffees.find(
    (coffee) => coffee.slug === slug && coffee.status !== "draft",
  );
  return coffee ? publicEntry(content, coffee) : undefined;
}
export function featuredCatalog(content: Content): CatalogEntry[] {
  const catalog = publishedCatalog(content);
  return content.home.featuredCoffeeIds.flatMap((id) => {
    const entry = catalog.find((item) => item.coffee.id === id);
    return entry ? [entry] : [];
  });
}
export function projectCoffee(entry: CatalogEntry, selectedLotId?: string) {
  const { coffee, lots } = entry;
  const lot =
    lots.find((item) => item.id === selectedLotId) ??
    lots.find((item) => item.id === coffee.primaryLotId) ??
    lots[0];
  return {
    ...coffee,
    lotId: lot?.id ?? null,
    lot: lot?.code ?? "Lote a confirmar",
    profile: lot?.profile ?? "Perfil a confirmar",
    notes: lot?.notes.join(" e ") || "Notas a confirmar",
    acidity: lot?.acidity ?? null,
    body: lot?.body ?? null,
    origin: lot?.origin ?? "Origem a confirmar.",
    variety: lot?.variety ?? null,
    score: lot?.score ?? null,
    roast: lot?.roast ?? "A confirmar",
    producers: lot?.producers.join(" e ") || "Informação a confirmar",
    preparation: lot?.preparations.join(" · ") || "Preparo a confirmar",
  };
}
export type CoffeeView = ReturnType<typeof projectCoffee>;
export function catalogFilters(entries: CatalogEntry[]) {
  const unique = (values: (string | null)[]) =>
    [
      ...new Set(values.filter((value): value is string => value !== null)),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const lots = entries.flatMap((entry) => entry.lots);
  return {
    profiles: unique(lots.map((lot) => lot.profile)),
    roasts: unique(lots.map((lot) => lot.roast)),
    preparations: unique(lots.flatMap((lot) => lot.preparations)),
  };
}
export function filterCatalog(
  entries: CatalogEntry[],
  filters: {
    query: string;
    profile: string;
    roast: string;
    preparation: string;
  },
) {
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");
  return entries.filter((entry) => {
    const matchesCoffee = `${entry.coffee.name} ${entry.coffee.description}`
      .toLocaleLowerCase("pt-BR")
      .includes(query);
    if (!entry.lots.length)
      return (
        !filters.profile &&
        !filters.roast &&
        !filters.preparation &&
        matchesCoffee
      );
    return entry.lots.some(
      (lot) =>
        (!filters.profile || lot.profile === filters.profile) &&
        (!filters.roast || lot.roast === filters.roast) &&
        (!filters.preparation ||
          lot.preparations.includes(filters.preparation)) &&
        (matchesCoffee ||
          `${lot.code} ${lot.notes.join(" ")} ${lot.producers.join(" ")}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)),
    );
  });
}

// Next 15's static export rejects an empty generateStaticParams result. This
// reserved, non-editorial slug renders notFound() and never represents a coffee.
export const EMPTY_CATALOG_ROUTE = "_catalogo-vazio";
export function publicProductRoutes(content: Content) {
  const routes = content.coffees
    .filter((coffee) => coffee.status !== "draft")
    .map(({ slug }) => ({ slug }));
  return routes.length ? routes : [{ slug: EMPTY_CATALOG_ROUTE }];
}
