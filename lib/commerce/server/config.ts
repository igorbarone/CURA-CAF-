import { z } from "zod";
// Server configuration, from environment variables only (never the repo or
// the CMS). Each integration is "configured" only when all its keys exist;
// missing keys switch that capability off instead of faking it.
const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);
const schema = z.object({
  CURA_COMMERCE: optional,
  SITE_URL: optional,
  DATABASE_URL: optional,
  ORDER_TOKEN_SECRET: optional,
  MP_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  CURA_ALLOW_LIVE_PAYMENTS: optional,
  MP_ACCESS_TOKEN: optional,
  MP_PUBLIC_KEY: optional,
  MP_WEBHOOK_SECRET: optional,
  MP_API_BASE: z.string().url().default("https://api.mercadopago.com"),
  MELHOR_ENVIO_TOKEN: optional,
  MELHOR_ENVIO_API_BASE: z
    .string()
    .url()
    .default("https://sandbox.melhorenvio.com.br"),
  MELHOR_ENVIO_USER_AGENT: optional,
  MELHOR_ENVIO_SERVICES: optional,
  SHIPPING_ORIGIN_CEP: optional,
  SHIPPING_BOX_CM: z
    .string()
    .regex(/^\d+x\d+x\d+$/)
    .optional(),
  SHIPPING_TARE_GRAMS: z.coerce.number().int().nonnegative().optional(),
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  RESEND_API_BASE: z.string().url().default("https://api.resend.com"),
  // Set by the Vercel platform and by its Postgres integrations.
  VERCEL_PROJECT_PRODUCTION_URL: optional,
  POSTGRES_URL: optional,
  CURA_STOCK_FROM_CMS: optional,
});
export type CommerceConfig = ReturnType<typeof readConfig>;
export function readConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const parsed = schema.parse(env);
  // On Vercel, fall back to the project's own address and database variable.
  const raw = {
    ...parsed,
    SITE_URL:
      parsed.SITE_URL ??
      (parsed.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${parsed.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined),
    DATABASE_URL: parsed.DATABASE_URL ?? parsed.POSTGRES_URL,
  };
  const enabled =
    raw.CURA_COMMERCE === "enabled" &&
    !!raw.SITE_URL &&
    !!raw.DATABASE_URL &&
    !!raw.ORDER_TOKEN_SECRET &&
    raw.ORDER_TOKEN_SECRET.length >= 32;
  // Real charges need an explicit, separate opt-in on top of production keys.
  const liveBlocked =
    raw.MP_ENVIRONMENT === "production" &&
    raw.CURA_ALLOW_LIVE_PAYMENTS !== "true";
  const payments =
    enabled && !liveBlocked && !!raw.MP_ACCESS_TOKEN && !!raw.MP_WEBHOOK_SECRET;
  const shipping =
    enabled &&
    !!raw.MELHOR_ENVIO_TOKEN &&
    !!raw.MELHOR_ENVIO_USER_AGENT &&
    !!raw.SHIPPING_ORIGIN_CEP &&
    !!raw.SHIPPING_BOX_CM &&
    raw.SHIPPING_TARE_GRAMS !== undefined;
  const [height, width, length] = (raw.SHIPPING_BOX_CM ?? "0x0x0")
    .split("x")
    .map(Number);
  return {
    enabled,
    payments,
    card: payments && !!raw.MP_PUBLIC_KEY,
    shipping,
    email: !!raw.RESEND_API_KEY && !!raw.EMAIL_FROM,
    environment: raw.MP_ENVIRONMENT,
    stockFromCms: raw.CURA_STOCK_FROM_CMS === "true",
    siteUrl: raw.SITE_URL?.replace(/\/$/, "") ?? "",
    databaseUrl: raw.DATABASE_URL ?? "",
    orderTokenSecret: raw.ORDER_TOKEN_SECRET ?? "",
    mp: {
      base: raw.MP_API_BASE,
      accessToken: raw.MP_ACCESS_TOKEN ?? "",
      publicKey: raw.MP_PUBLIC_KEY ?? "",
      webhookSecret: raw.MP_WEBHOOK_SECRET ?? "",
    },
    melhorEnvio: {
      base: raw.MELHOR_ENVIO_API_BASE,
      token: raw.MELHOR_ENVIO_TOKEN ?? "",
      userAgent: raw.MELHOR_ENVIO_USER_AGENT ?? "",
      services: raw.MELHOR_ENVIO_SERVICES,
      originCep: raw.SHIPPING_ORIGIN_CEP ?? "",
      box: { height, width, length },
      tareGrams: raw.SHIPPING_TARE_GRAMS ?? 0,
    },
    resend: {
      base: raw.RESEND_API_BASE,
      apiKey: raw.RESEND_API_KEY ?? "",
      from: raw.EMAIL_FROM ?? "",
    },
  };
}
