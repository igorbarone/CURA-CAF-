import { contentSchema, type Content } from "../../lib/content-schema";
export type LegacyCoffee = {
  name: string;
  slug: string;
  profile: string;
  acidity: string;
  body: string | null;
  origin: string;
  variety: string | null;
  lot: string;
  score: number;
  roast: string;
  notes: string;
  description: string;
  producers: string;
  preparation: string;
  tone: string;
};
/** One-time migration adapter; not used by the application or CMS. */
export function migrateLegacyCatalog(rows: LegacyCoffee[]): Content {
  return contentSchema.parse({
    coffees: rows.map((row, sortOrder) => ({
      id: row.slug,
      slug: row.slug,
      name: row.name,
      description: row.description,
      tone: row.tone,
      status: "published",
      sortOrder,
      primaryLotId: row.lot.toLowerCase(),
      media: null,
    })),
    lots: rows.map((row) => ({
      id: row.lot.toLowerCase(),
      coffeeId: row.slug,
      code: row.lot,
      status: "published",
      sortOrder: 0,
      profile: row.profile,
      acidity: row.acidity,
      body: row.body,
      origin: row.origin,
      variety: row.variety,
      score: row.score,
      roast: row.roast,
      notes: row.notes.split(" e "),
      producers: row.producers.split(" e "),
      preparations: row.preparation.split(" · "),
    })),
    offers: [],
    home: {
      eyebrow: "01 / A NOSSA SELEÇÃO",
      title: "A nossa seleção.",
      emphasis: "Jeitos de sentir.",
      intro:
        "Lotes reais, personalidades próprias e informação clara para acompanhar cada escolha.",
      featuredCoffeeIds: rows.map((row) => row.slug),
    },
  });
}
