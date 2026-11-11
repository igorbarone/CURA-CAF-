// Zod schemas for the CURA Experience editorial content (content/experience).
// Kept free of Node APIs so pure logic and client components can share types.
import { z } from "zod";

const text = z.string().trim().min(1);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const strengths = ["suave", "equilibrado", "intenso"] as const;
export type Strength = (typeof strengths)[number];

const pour = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bloom") }).strict(),
  z
    .object({ type: z.literal("fraction"), value: z.number().gt(0).max(1) })
    .strict(),
]);
export const brewStepSchema = z
  .object({
    title: text,
    text,
    /** What the person should see happen (optional cue). */
    observe: text.optional(),
    /** Second (from the start of the timer) at which this step begins. */
    at: z.number().int().nonnegative().optional(),
    pour: pour.optional(),
  })
  .strict();
const ratioSet = z
  .object({ suave: z.number(), equilibrado: z.number(), intenso: z.number() })
  .strict();
export const methodKinds = [
  "filter",
  "immersion",
  "espresso",
  "moka",
  "cold",
] as const;
export const inputModes = ["cups", "coffee", "water", "size"] as const;
export const methodSchema = z
  .object({
    id: slug,
    name: text,
    /** Selects the calculation model in lib/experience/brew.ts. */
    kind: z.enum(methodKinds),
    summary: text,
    /** Matches the lot's printed "preparations" (e.g. "Coado", "Espresso"). */
    catalogPreparations: z.array(text),
    /** Input modes offered for this method, in display order. */
    modes: z.array(z.enum(inputModes)).min(1),
    /** coffee × ratio = brewing water; for espresso, = beverage yield. */
    ratio: ratioSet.optional(),
    ratioRange: z
      .tuple([z.number().positive(), z.number().positive()])
      .optional(),
    presets: z.array(z.number().positive()).optional(),
    cup: z.object({ ml: z.number().positive(), label: text }).strict(),
    capacity: z
      .object({
        maxWaterPerRound: z.number().positive(),
        nominalMl: z.number().positive().optional(),
        /** "manufacturer": published by the maker; "practical": Cura's own reference. */
        source: z.enum(["manufacturer", "practical"]),
        note: text,
      })
      .strict()
      .optional(),
    espresso: z
      .object({
        defaultDose: z.number().positive(),
        minDose: z.number().positive(),
        maxDose: z.number().positive(),
        note: text,
        pressurized: text,
      })
      .strict()
      .optional(),
    moka: z
      .object({
        sizes: z.array(z.number().int().positive()).min(1),
        defaultSize: z.number().int().positive(),
        waterPerCupMl: z.number().positive(),
        coffeePerCupGrams: z.number().positive(),
        note: text,
      })
      .strict()
      .optional(),
    cold: z
      .object({ dilution: z.number().positive(), note: text })
      .strict()
      .optional(),
    bloomFactor: z.number().positive().nullable(),
    grind: z.object({ beginner: text, advanced: text }).strict(),
    temperature: z
      .object({
        celsius: z.tuple([z.number(), z.number()]).nullable(),
        beginner: text,
      })
      .strict(),
    time: z
      .object({
        seconds: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
        label: text,
      })
      .strict(),
    /** null: no timer (the machine or the fridge keeps time). */
    timer: z.object({ start: text, button: text }).strict().nullable(),
    steps: z.array(brewStepSchema).min(1),
  })
  .strict()
  .superRefine((method, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message: `${method.id}: ${message}` });
    if (method.kind === "moka") {
      if (!method.moka) issue("moka exige o bloco moka");
      else if (!method.moka.sizes.includes(method.moka.defaultSize))
        issue("tamanho padrão da moka fora da lista");
    } else {
      if (!method.ratio || !method.ratioRange || !method.presets)
        issue("ratio, ratioRange e presets são obrigatórios");
      if (method.ratio && method.ratioRange) {
        const { suave, equilibrado, intenso } = method.ratio;
        const [min, max] = method.ratioRange;
        // A higher ratio means more water per gram: lighter cup.
        if (!(suave >= equilibrado && equilibrado >= intenso))
          issue("proporções devem ir de suave (mais água) a intenso");
        if (intenso < min || suave > max)
          issue("proporções fora de ratioRange");
      }
    }
    if (method.kind === "espresso") {
      if (!method.espresso) issue("espresso exige o bloco espresso");
      else if (
        method.espresso.defaultDose < method.espresso.minDose ||
        method.espresso.defaultDose > method.espresso.maxDose
      )
        issue("dose padrão fora do intervalo");
    }
    if (method.kind === "cold" && !method.cold)
      issue("cold exige o bloco cold");
    if (
      method.kind === "moka" &&
      !method.modes.every((mode) => mode === "size")
    )
      issue("moka usa apenas o modo size");
    if (method.kind !== "moka" && method.modes.includes("size"))
      issue("modo size é exclusivo da moka");
    const timed = method.steps.filter((step) => step.at !== undefined);
    for (let i = 1; i < timed.length; i++)
      if ((timed[i].at ?? 0) < (timed[i - 1].at ?? 0))
        issue("etapas temporizadas fora de ordem");
    let last = 0;
    for (const step of method.steps)
      if (step.pour?.type === "fraction") {
        if (step.pour.value < last) issue("despejos devem ser crescentes");
        last = step.pour.value;
      }
    const pours = method.steps.filter((step) => step.pour);
    if (pours.length && last !== 1)
      issue("o último despejo deve completar 100% da água");
    if (
      method.steps.some((step) => step.pour?.type === "bloom") &&
      !method.bloomFactor
    )
      issue("pré-infusão exige bloomFactor");
    if (method.timer && !timed.length) issue("timer sem etapas temporizadas");
    if (!method.timer && timed.length)
      issue("etapas temporizadas exigem timer");
  });
export type BrewMethod = z.infer<typeof methodSchema>;
export type MethodKind = BrewMethod["kind"];
export type InputMode = (typeof inputModes)[number];
export const methodsSchema = z
  .object({ methods: z.array(methodSchema).min(1) })
  .strict()
  .superRefine((value, ctx) => {
    const ids = value.methods.map((method) => method.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "métodos duplicados" });
  });

const lesson = z
  .object({
    id: slug,
    title: text,
    summary: text,
    body: z.array(text).min(1),
    example: text.optional(),
    keyIdea: text.optional(),
  })
  .strict();
export type Lesson = z.infer<typeof lesson>;
export const academySchema = z
  .object({
    modules: z
      .array(
        z
          .object({
            id: slug,
            number: z.number().int().positive(),
            title: text,
            level: text,
            audience: text,
            intro: text,
            interactive: z.enum(["none", "tasting", "extraction"]),
            lessons: z.array(lesson).min(1),
          })
          .strict(),
      )
      .min(1),
    attributes: z
      .array(
        z
          .object({
            id: slug,
            name: text,
            definition: text,
            howTo: text,
            analogy: text,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type Academy = z.infer<typeof academySchema>;
export type AcademyModule = Academy["modules"][number];
export type TastingAttribute = Academy["attributes"][number];

export const journeySchema = z
  .object({
    intro: z
      .object({
        eyebrow: text,
        title: text,
        subtitle: text,
        cta: text,
        paths: z
          .array(z.object({ id: slug, title: text, text, href: text }).strict())
          .length(3),
      })
      .strict(),
    terroir: z.object({ title: text, text, analogy: text }).strict(),
    curation: z.object({ title: text, text }).strict(),
    cycle: z.array(z.object({ id: slug, title: text, text }).strict()).min(1),
    roasts: z
      .array(
        z
          .object({
            id: slug,
            name: text,
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            aroma: text,
            flavor: text,
            body: text,
            bitterness: text,
          })
          .strict(),
      )
      .min(2),
    roastNote: text,
    cup: z.object({ title: text, text, cta: text }).strict(),
  })
  .strict();
export type Journey = z.infer<typeof journeySchema>;

export const adjustmentSchema = z
  .object({
    /** Added to the ratio (positive: more water per gram, lighter cup). */
    ratioDelta: z.number().optional(),
    grind: z.enum(["mais-grossa", "mais-fina"]).optional(),
    /** Seconds added to immersion / extraction time. */
    timeDelta: z.number().int().optional(),
    temperature: z.enum(["mais-quente", "menos-quente"]).optional(),
  })
  .strict();
export type Adjustment = z.infer<typeof adjustmentSchema>;
export const diagnosisSchema = z
  .object({
    question: text,
    options: z
      .array(
        z
          .object({
            id: slug,
            label: text,
            summary: text,
            checks: z.array(text),
            /** Extra question when the person cannot tell what is wrong. */
            followUp: z
              .object({
                question: text,
                options: z
                  .array(z.object({ label: text, to: slug }).strict())
                  .min(2),
              })
              .strict()
              .optional(),
            /** Ordered adjustments; method-specific ones replace general ones. */
            adjustments: z.array(
              z
                .object({
                  variable: z.enum([
                    "moagem",
                    "proporcao",
                    "tempo",
                    "temperatura",
                    "frescor",
                    "agua",
                    "nenhuma",
                  ]),
                  text,
                  methods: z.array(slug).optional(),
                  notFor: z.array(slug).optional(),
                  /** Machine-readable form of the advice, used for "tentar de novo". */
                  apply: adjustmentSchema.optional(),
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .min(2),
    oneVariable: text,
  })
  .strict();
export type Diagnosis = z.infer<typeof diagnosisSchema>;

export const tasteSchema = z
  .object({
    questions: z
      .array(
        z
          .object({
            id: slug,
            title: text,
            options: z
              .array(
                z
                  .object({
                    id: slug,
                    label: text,
                    points: z.record(slug, z.number()),
                    traits: z.array(slug).default([]),
                  })
                  .strict(),
              )
              .min(2),
          })
          .strict(),
      )
      .min(1),
    profiles: z
      .array(
        z
          .object({
            id: slug,
            name: text,
            description: text,
            traits: z.array(slug).min(1),
          })
          .strict(),
      )
      .min(1),
    /** Keywords that recognise a trait in published lot attributes. */
    traits: z
      .array(
        z
          .object({
            id: slug,
            label: text,
            keywords: z.array(text).min(1),
            fields: z
              .array(
                z.enum([
                  "profile",
                  "notes",
                  "acidity",
                  "body",
                  "roast",
                  "preparations",
                ]),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
    disclaimer: text,
  })
  .strict();
export type Taste = z.infer<typeof tasteSchema>;

export const baristaSchema = z
  .object({
    greeting: text,
    disclaimer: text,
    topics: z
      .array(
        z
          .object({
            id: slug,
            label: text,
            keywords: z.array(text).min(1),
            answer: z.array(text).min(1),
            followUps: z.array(slug).default([]),
            link: z.object({ href: text, label: text }).strict().optional(),
          })
          .strict(),
      )
      .min(1),
    starters: z.array(slug).min(1),
  })
  .strict();
export type BaristaKnowledge = z.infer<typeof baristaSchema>;
