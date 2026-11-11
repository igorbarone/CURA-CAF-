import type { CatalogEntry } from "../catalog-model";
import type { Lot } from "../content-schema";

/**
 * CURA Experience coffee model. Every attribute except identity is optional:
 * the projection copies only what the published lot confirms, and the UI hides
 * any field that is missing. Nothing here is ever filled with a placeholder.
 *
 * Sensory levels use the documented 1–5 scale (docs/EXPERIENCIA.md):
 * 1 muito baixa · 2 baixa · 3 média · 4 alta · 5 muito alta.
 */
export type SensoryLevel = 1 | 2 | 3 | 4 | 5;
export type ExperienceCoffee = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  tone: string;
  lotId?: string;
  lotCode?: string;
  score?: number;
  images: { src: string; alt: string; credit: string; kind: string }[];
  origin?: {
    region?: string;
    farm?: string;
    producers?: string[];
    latitude?: number;
    longitude?: number;
    altitudeMeters?: number;
    harvest?: string;
  };
  variety?: string;
  process?: string;
  roast?: string;
  profile?: string;
  sensory?: {
    notes?: string[];
    acidity?: string;
    body?: string;
    levels?: Partial<
      Record<"intensity" | "acidity" | "sweetness" | "body", SensoryLevel>
    >;
  };
  /** Confirmed texts only (lot.producerStory / lot.curationNote). */
  story?: { producer?: string; curation?: string };
  /** Preparations printed on the label (e.g. "Coado", "Espresso"). */
  preparations: string[];
  /** Grind formats of the published offers (e.g. "Em grãos"). */
  formats: string[];
  productUrl: string;
  hasOffer: boolean;
};

export const sensoryLevelLabels: Record<SensoryLevel, string> = {
  1: "Muito baixa",
  2: "Baixa",
  3: "Média",
  4: "Alta",
  5: "Muito alta",
};

const present = <T>(value: T | null | undefined): T | undefined =>
  value === null || value === undefined || value === "" ? undefined : value;

function compact<T extends Record<string, unknown>>(value: T) {
  const entries = Object.entries(value).filter(
    ([, item]) =>
      item !== undefined && !(Array.isArray(item) && item.length === 0),
  );
  return entries.length
    ? (Object.fromEntries(entries) as Partial<T>)
    : undefined;
}

export function coffeeCategory(lot: Lot | undefined) {
  // Derived from data, never from the coffee's name: a scored lot is a
  // specialty coffee; the Linha Casa blend has no score on its label.
  if (lot?.score != null && lot.score >= 80) return "Café especial";
  if (lot?.code.toUpperCase().startsWith("LINHA CASA")) return "Café gourmet";
  return "Café";
}

export function toExperienceCoffee(entry: CatalogEntry): ExperienceCoffee {
  const { coffee, lots, offers } = entry;
  const lot = lots.find((item) => item.id === coffee.primaryLotId) ?? lots[0];
  const images = [coffee.media, ...coffee.gallery]
    .filter((media) => media !== null)
    .map((media) => ({
      src: media.src,
      alt: media.alt,
      credit: media.credit,
      kind: media.kind,
    }));
  const levels = lot
    ? compact({
        intensity: present(lot.intensityLevel) as SensoryLevel | undefined,
        acidity: present(lot.acidityLevel) as SensoryLevel | undefined,
        sweetness: present(lot.sweetnessLevel) as SensoryLevel | undefined,
        body: present(lot.bodyLevel) as SensoryLevel | undefined,
      })
    : undefined;
  return {
    id: coffee.id,
    slug: coffee.slug,
    name: coffee.name,
    category: coffeeCategory(lot),
    description: coffee.description,
    tone: coffee.tone,
    lotId: lot?.id,
    lotCode: lot?.code,
    score: present(lot?.score),
    images,
    origin: lot
      ? compact({
          region: present(lot.region),
          farm: present(lot.farm),
          producers: lot.producers,
          latitude: present(lot.latitude),
          longitude: present(lot.longitude),
          altitudeMeters: present(lot.altitudeMeters),
          harvest: present(lot.harvest),
        })
      : undefined,
    variety: present(lot?.variety),
    process: present(lot?.process),
    roast: present(lot?.roast),
    profile: present(lot?.profile),
    sensory: lot
      ? compact({
          notes: lot.notes,
          acidity: present(lot.acidity),
          body: present(lot.body),
          levels,
        })
      : undefined,
    story: lot
      ? compact({
          producer: present(lot.producerStory),
          curation: present(lot.curationNote),
        })
      : undefined,
    preparations: lot?.preparations ?? [],
    formats: [
      ...new Set(
        offers
          .filter((offer) => offer.lotId === lot?.id && offer.grind)
          .map((offer) => offer.grind as string),
      ),
    ],
    productUrl: `/cafes/${coffee.slug}/`,
    hasOffer: offers.length > 0,
  };
}

export function hasCoordinates(coffee: ExperienceCoffee) {
  return (
    coffee.origin?.latitude !== undefined &&
    coffee.origin?.longitude !== undefined
  );
}
