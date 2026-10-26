import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
const text = z.string().trim().min(1);
const section = { eyebrow: text, title: text, emphasis: text, intro: text };
const article = z.object({ title: text, text }).strict();
export const editorialSchema = z
  .object({
    hero: z
      .object({
        eyebrow: text,
        line1: text,
        line2: text,
        description: text,
        primaryCta: text,
        secondaryCta: text,
        artLabel: text,
        originSignature: text,
      })
      .strict(),
    curation: z
      .object({
        eyebrow: text,
        title: text,
        emphasis: text,
        intro: text,
        steps: z.array(z.object({ title: text, text }).strict()).min(1),
      })
      .strict(),
    story: z
      .object({
        eyebrow: text,
        title: text,
        emphasis: text,
        intro: text,
        paragraphs: z.array(text).min(1),
      })
      .strict(),
    club: z
      .object({
        eyebrow: text,
        title: text,
        emphasis: text,
        intro: text,
        paragraphs: z.array(text).min(1),
        pendingItems: z.array(text).min(1),
      })
      .strict(),
    quiz: z
      .object({
        eyebrow: text,
        title: text,
        emphasis: text,
        intro: text,
        help: text,
        resultTitle: text,
        empty: text,
        noMatch: text,
      })
      .strict(),
    access: z.object({ ...section, pillars: z.array(article).min(1) }).strict(),
    producers: z.object(section).strict(),
    business: z
      .object({
        ...section,
        ctaLabel: text,
        segmentsTitle: text,
        segmentsIntro: text,
        segments: z.array(article).min(1),
        benefitsTitle: text,
        benefitsIntro: text,
        benefits: z.array(article).min(1),
        coffeesTitle: text,
        coffeesIntro: text,
        coffeesEmpty: text,
        purposeTitle: text,
        purposeText: text,
        intakeTitle: text,
        intakeItems: z.array(text).min(1),
        nextTitle: text,
        nextText: text,
      })
      .strict(),
    footer: z.object({ tagline: text, notice: text }).strict(),
  })
  .strict();
export type Editorial = z.infer<typeof editorialSchema>;
export function getEditorial() {
  return editorialSchema.parse(
    JSON.parse(readFileSync(join(process.cwd(), "content/site.json"), "utf8")),
  );
}
