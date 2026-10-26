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
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const statusSchema = z.enum(["draft", "published", "archived"]);
export const coffeeSchema = z
  .object({
    id,
    slug: id,
    name: text,
    description: text,
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
            kind: z.enum(["photograph", "artwork"]).default("photograph"),
            src: z
              .string()
              .regex(
                /^(?:\/media\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|avif)|\/media\/rotulo-[a-z0-9-]+\.svg)$/,
              ),
            alt: text,
            credit: text,
          })
          .strict()
          .nullish(),
      )
      .transform((value) => value ?? null),
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
    roast: nullableText,
  })
  .strict();
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
    unique(data.home.featuredCoffeeIds, "home.featuredCoffeeIds");
    for (const lot of data.lots)
      if (!data.coffees.some((x) => x.id === lot.coffeeId))
        issue(`Lote ${lot.id}: café inexistente`);
    for (const offer of data.offers)
      if (!data.lots.some((x) => x.id === offer.lotId))
        issue(`Oferta ${offer.id}: lote inexistente`);
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
export type Content = z.infer<typeof contentSchema>;
