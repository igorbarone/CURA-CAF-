import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
// Commercial rules approved by the team, edited in the CMS. Incentives stay
// off (null) until someone approves them; nothing here is a default promise.
export const commerceRulesSchema = z
  .object({
    freeShippingFromCents: z
      .preprocess(
        (value) => (value === "" ? null : value),
        z.number().int().positive().nullish(),
      )
      .transform((value) => value ?? null),
    maxQuantityPerLine: z.number().int().min(1).max(50).default(10),
    pixExpirationMinutes: z.number().int().min(10).max(1440).default(30),
  })
  .strict();
export type CommerceRules = z.infer<typeof commerceRulesSchema>;
export function getCommerceRules(
  root = process.env.CURA_CONTENT_ROOT ?? process.cwd(),
): CommerceRules {
  const file = join(root, "content/commerce.json");
  return commerceRulesSchema.parse(
    existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {},
  );
}
