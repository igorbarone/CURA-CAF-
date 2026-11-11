import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
// Commercial rules approved by the team, edited in the CMS. Incentives stay
// off (null) until someone approves them; nothing here is a default promise.
const nullableCents = z
  .preprocess(
    (value) => (value === "" ? null : value),
    z.number().int().positive().nullish(),
  )
  .transform((value) => value ?? null);
// A shipping box (team data). Inner size decides what fits; outer size and
// tare (empty box + filling) are what the carrier quotes.
export const boxSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    label: z.string().trim().min(1),
    innerHeightCm: z.number().positive().max(100),
    innerWidthCm: z.number().positive().max(100),
    innerLengthCm: z.number().positive().max(100),
    outerHeightCm: z.number().positive().max(100),
    outerWidthCm: z.number().positive().max(100),
    outerLengthCm: z.number().positive().max(100),
    tareGrams: z.number().int().nonnegative().max(5000),
  })
  .strict();
export type Box = z.infer<typeof boxSchema>;
export const commerceRulesSchema = z
  .object({
    freeShippingFromCents: nullableCents,
    // Fixed amount the store pays of each freight (null = customer pays all).
    shippingSubsidyCents: nullableCents,
    maxQuantityPerLine: z.number().int().min(1).max(50).default(10),
    pixExpirationMinutes: z.number().int().min(10).max(1440).default(30),
    cardExpirationMinutes: z.number().int().min(10).max(1440).default(60),
    // Discount on the coffee subtotal (never on freight) for Pix payments.
    pixDiscountPercent: z.number().min(0).max(50).default(0),
    // Internal margin assumption for indicators. Never charged to the buyer.
    cardFeeAssumptionPercent: z.number().min(0).max(20).default(0),
    // Packing: heaviest volume accepted and how full a box may get (volume).
    maxVolumeWeightGrams: z.number().int().min(300).max(30000).default(4000),
    packingFillFactor: z.number().min(0.3).max(1).default(0.8),
    // Melhor Envio service ids offered (e.g. 1 = Correios PAC, 3 = Jadlog
    // .Package). What is really available comes from each quote.
    shippingServiceIds: z
      .array(z.string().regex(/^\d+$/))
      .nullish()
      .transform((value) => value ?? []),
    boxes: z
      .array(boxSchema)
      .nullish()
      .transform((value) => value ?? []),
  })
  .strict()
  .superRefine((rules, ctx) => {
    for (const box of rules.boxes)
      if (
        box.innerHeightCm > box.outerHeightCm ||
        box.innerWidthCm > box.outerWidthCm ||
        box.innerLengthCm > box.outerLengthCm
      )
        ctx.addIssue({
          code: "custom",
          message: `Caixa ${box.id}: medida interna maior que a externa`,
        });
    if (new Set(rules.boxes.map((box) => box.id)).size !== rules.boxes.length)
      ctx.addIssue({ code: "custom", message: "Caixas com id repetido" });
  });
export type CommerceRules = z.infer<typeof commerceRulesSchema>;
// The subset the browser needs (cart math and messages).
export type ClientRules = Pick<
  CommerceRules,
  | "freeShippingFromCents"
  | "shippingSubsidyCents"
  | "maxQuantityPerLine"
  | "pixDiscountPercent"
>;
export const clientRules = (rules: CommerceRules): ClientRules => ({
  freeShippingFromCents: rules.freeShippingFromCents,
  shippingSubsidyCents: rules.shippingSubsidyCents,
  maxQuantityPerLine: rules.maxQuantityPerLine,
  pixDiscountPercent: rules.pixDiscountPercent,
});
export function getCommerceRules(
  root = process.env.CURA_CONTENT_ROOT ?? process.cwd(),
): CommerceRules {
  const file = join(root, "content/commerce.json");
  return commerceRulesSchema.parse(
    existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {},
  );
}
