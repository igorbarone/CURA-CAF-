import { z } from "zod";
const text = z.string().trim().min(1);
const nullableText = z
  .preprocess(
    (value) => (typeof value === "string" && !value.trim() ? null : value),
    text.nullish(),
  )
  .transform((value) => value ?? null);
const nullableNumber = (schema: z.ZodNumber) =>
  z
    .preprocess((value) => (value === "" ? null : value), schema.nullish())
    .transform((value) => value ?? null);
// 1–5 sensory scale used by the CURA Experience; null = not published.
const sensoryLevel = z
  .preprocess(
    (value) => (value === "" ? null : value),
    z.number().int().min(1).max(5).nullish(),
  )
  .transform((value) => value ?? null);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
// Calendar date (YYYY-MM-DD, Brasília) for sale windows; empty = no limit.
const nullableDate = z
  .preprocess(
    (value) => (value === "" ? null : value),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
  )
  .transform((value) => value ?? null);
const nullableInt = (min: number, max: number) =>
  nullableNumber(z.number().int().min(min).max(max));
const mediaSrc = z
  .string()
  .regex(
    /^(?:\/media\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|avif)|\/media\/rotulo-[a-z0-9-]+\.svg)$/,
  );
// Extra product photos. Each one needs alt text and a credit, like `media`.
const galleryItem = z
  .object({
    kind: z
      .enum(["photograph", "artwork", "illustration"])
      .default("photograph"),
    src: mediaSrc,
    alt: text,
    credit: text,
  })
  .strict();
export const statusSchema = z.enum(["draft", "published", "archived"]);
export const coffeeSchema = z
  .object({
    id,
    slug: id,
    name: text,
    description: text,
    // Optional editorial depth and SEO; empty fields fall back to description.
    longDescription: nullableText,
    highlights: z
      .array(text)
      .nullish()
      .transform((value) => value ?? []),
    seoTitle: nullableText,
    seoDescription: nullableText,
    status: statusSchema,
    sortOrder: z.number().int().nonnegative(),
    primaryLotId: z
      .preprocess((value) => (value === "" ? null : value), id.nullish())
      .transform((value) => value ?? null),
    tone: z.enum(["rapadura", "anil", "amora", "ipe", "cacau", "cura"]),
    media: z
      .preprocess(
        (value) =>
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          Object.entries(value)
            .filter(([key]) => key !== "kind")
            .every(([, item]) => item === "" || item == null)
            ? null
            : value,
        z
          .object({
            kind: z
              .enum(["photograph", "artwork", "illustration"])
              .default("photograph"),
            lotId: z
              .preprocess(
                (value) => (value === "" ? null : value),
                id.nullish(),
              )
              .transform((value) => value ?? null),
            src: mediaSrc,
            alt: text,
            credit: text,
          })
          .strict()
          .nullish(),
      )
      .transform((value) => value ?? null),
    gallery: z
      .array(galleryItem)
      .nullish()
      .transform((value) => value ?? []),
  })
  .strict();
export const lotSchema = z
  .object({
    id,
    coffeeId: id,
    code: text,
    status: statusSchema,
    sortOrder: z.number().int().nonnegative(),
    curationNote: nullableText,
    producerStory: nullableText,
    profile: nullableText,
    notes: z
      .array(text)
      .nullish()
      .transform((value) => value ?? []),
    producers: z
      .array(text)
      .nullish()
      .transform((value) => value ?? []),
    preparations: z
      .array(text)
      .nullish()
      .transform((value) => value ?? []),
    acidity: nullableText,
    body: nullableText,
    origin: nullableText,
    variety: nullableText,
    score: nullableNumber(z.number().min(0).max(100)),
    // How the score was obtained (e.g. "SCA, avaliação do produtor").
    scoreMethodology: nullableText,
    roast: nullableText,
    // Structured traceability (CURA Experience). Optional: only confirmed data
    // (e.g. printed on the official label); empty fields stay hidden.
    region: nullableText,
    municipality: nullableText,
    farm: nullableText,
    altitudeMeters: nullableNumber(z.number().int().positive().max(3000)),
    process: nullableText,
    harvest: nullableText,
    latitude: nullableNumber(z.number().min(-90).max(90)),
    longitude: nullableNumber(z.number().min(-180).max(180)),
    // Sensory intensity on the documented 1–5 scale (docs/EXPERIENCIA.md):
    // 1 = muito baixa, 3 = média, 5 = muito alta. Only from an official sheet.
    intensityLevel: sensoryLevel,
    acidityLevel: sensoryLevel,
    sweetnessLevel: sensoryLevel,
    bodyLevel: sensoryLevel,
    // Sale window of the lot. A new harvest is a new lot: the old one is
    // archived (never deleted), so its history stays traceable.
    saleStartsAt: nullableDate,
    saleEndsAt: nullableDate,
  })
  .strict();
// Offer = sellable variant (SKU) of a lot. A variant is sold only when it is
// published and has price, net and gross weight and package dimensions; see
// sellabilityIssues() in lib/commerce/catalog.ts.
export const offerSchema = z
  .object({
    id,
    lotId: id,
    status: statusSchema,
    sku: text,
    currency: z.literal("BRL"),
    unitPriceInCents: nullableNumber(z.number().int().safe().nonnegative()),
    availableQuantity: nullableNumber(z.number().int().safe().nonnegative()),
    weightInGrams: nullableNumber(z.number().int().positive()),
    grind: nullableText,
    // Optional approved promotional price; null = no promotion.
    promoPriceInCents: nullableNumber(z.number().int().safe().positive()),
    commercialLabel: nullableText,
    // Logistics of one packed unit (bag ready to ship), from the team.
    grossWeightInGrams: nullableInt(1, 30000),
    packageHeightCm: nullableNumber(z.number().positive().max(100)),
    packageWidthCm: nullableNumber(z.number().positive().max(100)),
    packageLengthCm: nullableNumber(z.number().positive().max(100)),
    minQuantity: nullableInt(1, 50),
    maxQuantity: nullableInt(1, 50),
    saleStartsAt: nullableDate,
    saleEndsAt: nullableDate,
  })
  .strict();
// Optional variant fields, all empty: a convenience for code that builds
// offers by hand (fixtures, scenarios).
export const offerExtras = {
  promoPriceInCents: null,
  commercialLabel: null,
  grossWeightInGrams: null,
  packageHeightCm: null,
  packageWidthCm: null,
  packageLengthCm: null,
  minQuantity: null,
  maxQuantity: null,
  saleStartsAt: null,
  saleEndsAt: null,
} as const;
// A kit is sold only with a price approved by the team; null keeps it hidden.
export const bundleSchema = z
  .object({
    id,
    name: text,
    description: text,
    status: statusSchema,
    sortOrder: z.number().int().nonnegative(),
    priceInCents: nullableNumber(z.number().int().safe().positive()),
    items: z
      .array(
        z
          .object({ offerId: id, quantity: z.number().int().min(1).max(10) })
          .strict(),
      )
      .min(2),
  })
  .strict();
export const homeSchema = z
  .object({
    eyebrow: text,
    title: text,
    emphasis: text,
    intro: text,
    featuredCoffeeIds: z
      .array(id)
      .nullish()
      .transform((value) => value ?? []),
  })
  .strict();
export const contentSchema = z
  .object({
    coffees: z.array(coffeeSchema),
    lots: z.array(lotSchema),
    offers: z.array(offerSchema),
    bundles: z.array(bundleSchema).default([]),
    home: homeSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    const unique = (values: string[], label: string) => {
      if (new Set(values).size !== values.length)
        issue(`${label}: valores duplicados`);
    };
    unique(
      data.coffees.map((x) => x.id),
      "coffee.id",
    );
    unique(
      data.coffees.map((x) => x.slug),
      "coffee.slug",
    );
    unique(
      data.lots.map((x) => x.id),
      "lot.id",
    );
    unique(
      data.lots.map((x) => x.code),
      "lot.code",
    );
    unique(
      data.offers.map((x) => x.id),
      "offer.id",
    );
    unique(
      data.offers.map((x) => x.sku),
      "offer.sku",
    );
    unique(
      data.bundles.map((x) => x.id),
      "bundle.id",
    );
    unique(data.home.featuredCoffeeIds, "home.featuredCoffeeIds");
    for (const bundle of data.bundles) {
      unique(
        bundle.items.map((item) => item.offerId),
        `Kit ${bundle.id}: ofertas`,
      );
      for (const item of bundle.items)
        if (!data.offers.some((offer) => offer.id === item.offerId))
          issue(`Kit ${bundle.id}: oferta ${item.offerId} inexistente`);
    }
    for (const lot of data.lots)
      if (!data.coffees.some((x) => x.id === lot.coffeeId))
        issue(`Lote ${lot.id}: café inexistente`);
    for (const lot of data.lots)
      if ((lot.latitude === null) !== (lot.longitude === null))
        issue(
          `Lote ${lot.id}: latitude e longitude devem ser preenchidas juntas`,
        );
    for (const offer of data.offers) {
      if (!data.lots.some((x) => x.id === offer.lotId))
        issue(`Oferta ${offer.id}: lote inexistente`);
      if (
        offer.promoPriceInCents !== null &&
        (offer.unitPriceInCents === null ||
          offer.promoPriceInCents >= offer.unitPriceInCents)
      )
        issue(
          `Oferta ${offer.id}: preço promocional precisa ser menor que o preço`,
        );
      if (
        offer.minQuantity !== null &&
        offer.maxQuantity !== null &&
        offer.minQuantity > offer.maxQuantity
      )
        issue(`Oferta ${offer.id}: quantidade mínima maior que a máxima`);
      const dims = [
        offer.packageHeightCm,
        offer.packageWidthCm,
        offer.packageLengthCm,
      ];
      if (dims.some((v) => v === null) && dims.some((v) => v !== null))
        issue(`Oferta ${offer.id}: informe as três dimensões da embalagem`);
      if (
        offer.grossWeightInGrams !== null &&
        offer.weightInGrams !== null &&
        offer.grossWeightInGrams < offer.weightInGrams
      )
        issue(`Oferta ${offer.id}: peso bruto menor que o peso líquido`);
    }
    for (const item of [...data.offers, ...data.lots])
      if (
        item.saleStartsAt &&
        item.saleEndsAt &&
        item.saleStartsAt > item.saleEndsAt
      )
        issue(`${item.id}: início de venda depois do fim`);
    for (const coffee of data.coffees)
      if (
        coffee.media?.lotId &&
        !data.lots.some(
          (lot) => lot.id === coffee.media?.lotId && lot.coffeeId === coffee.id,
        )
      )
        issue(`Café ${coffee.id}: lote da imagem inválido`);
    for (const coffee of data.coffees)
      if (
        coffee.primaryLotId &&
        !data.lots.some(
          (x) => x.id === coffee.primaryLotId && x.coffeeId === coffee.id,
        )
      )
        issue(`Café ${coffee.id}: lote principal inválido`);
    for (const coffeeId of data.home.featuredCoffeeIds)
      if (!data.coffees.some((x) => x.id === coffeeId))
        issue(`Home: café ${coffeeId} inexistente`);
  });
export type CoffeeEntity = z.infer<typeof coffeeSchema>;
export type Lot = z.infer<typeof lotSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type Bundle = z.infer<typeof bundleSchema>;
export type Content = z.infer<typeof contentSchema>;
