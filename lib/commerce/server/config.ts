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
  // Asaas: sandbox until the team explicitly enables real charges.
  ASAAS_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  CURA_ALLOW_LIVE_PAYMENTS: optional,
  ASAAS_API_KEY: optional,
  ASAAS_WEBHOOK_TOKEN: optional,
  ASAAS_API_BASE: z.string().url().optional(),
  ASAAS_USER_AGENT: optional,
  // Melhor Envio: quotes and labels (labels need the sender's data).
  MELHOR_ENVIO_ENVIRONMENT: z
    .enum(["sandbox", "production"])
    .default("sandbox"),
  MELHOR_ENVIO_TOKEN: optional,
  MELHOR_ENVIO_API_BASE: z.string().url().optional(),
  MELHOR_ENVIO_USER_AGENT: optional,
  SHIPPING_ORIGIN_CEP: optional,
  SHIPPING_FROM_NAME: optional,
  SHIPPING_FROM_DOCUMENT: optional,
  SHIPPING_FROM_COMPANY_DOCUMENT: optional,
  SHIPPING_FROM_STATE_REGISTER: optional,
  SHIPPING_FROM_PHONE: optional,
  SHIPPING_FROM_EMAIL: optional,
  SHIPPING_FROM_STREET: optional,
  SHIPPING_FROM_NUMBER: optional,
  SHIPPING_FROM_COMPLEMENT: optional,
  SHIPPING_FROM_DISTRICT: optional,
  SHIPPING_FROM_CITY: optional,
  SHIPPING_FROM_STATE: optional,
  // "true" only if the team confirms shipping with a content declaration
  // (no NF-e); otherwise each label needs the invoice key.
  SHIPPING_NON_COMMERCIAL: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  RESEND_API_BASE: z.string().url().default("https://api.resend.com"),
  // Operations panel (/admin): scrypt hash of the password + session secret.
  ADMIN_PASSWORD_HASH: optional,
  ADMIN_SESSION_SECRET: optional,
  // Protects the scheduled reconciliation endpoint (Vercel Cron sends it).
  CRON_SECRET: optional,
  // Set by the Vercel platform and by its Postgres integrations.
  VERCEL_PROJECT_PRODUCTION_URL: optional,
  POSTGRES_URL: optional,
  CURA_STOCK_FROM_CMS: optional,
});
export type CommerceConfig = ReturnType<typeof readConfig>;
const ASAAS_BASE = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};
const MELHOR_ENVIO_BASE = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://melhorenvio.com.br",
};
// Asaas keys carry their environment ($aact_hmlg_… sandbox, $aact_prod_…
// production). A key of the other environment is refused outright.
export function asaasKeyMatches(
  key: string,
  environment: "sandbox" | "production",
) {
  if (key.includes("_prod_")) return environment === "production";
  if (key.includes("_hmlg_")) return environment === "sandbox";
  return true;
}
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
    raw.ASAAS_ENVIRONMENT === "production" &&
    raw.CURA_ALLOW_LIVE_PAYMENTS !== "true";
  const keyOk =
    !!raw.ASAAS_API_KEY &&
    asaasKeyMatches(raw.ASAAS_API_KEY, raw.ASAAS_ENVIRONMENT);
  const payments =
    enabled &&
    !liveBlocked &&
    keyOk &&
    !!raw.ASAAS_WEBHOOK_TOKEN &&
    raw.ASAAS_WEBHOOK_TOKEN.length >= 16;
  const shipping =
    enabled && !!raw.MELHOR_ENVIO_TOKEN && !!raw.MELHOR_ENVIO_USER_AGENT;
  const sender = {
    name: raw.SHIPPING_FROM_NAME ?? "",
    document: raw.SHIPPING_FROM_DOCUMENT ?? "",
    companyDocument: raw.SHIPPING_FROM_COMPANY_DOCUMENT ?? "",
    stateRegister: raw.SHIPPING_FROM_STATE_REGISTER ?? "",
    phone: raw.SHIPPING_FROM_PHONE ?? "",
    email: raw.SHIPPING_FROM_EMAIL ?? "",
    street: raw.SHIPPING_FROM_STREET ?? "",
    number: raw.SHIPPING_FROM_NUMBER ?? "",
    complement: raw.SHIPPING_FROM_COMPLEMENT ?? "",
    district: raw.SHIPPING_FROM_DISTRICT ?? "",
    city: raw.SHIPPING_FROM_CITY ?? "",
    state: raw.SHIPPING_FROM_STATE ?? "",
    postalCode: raw.SHIPPING_ORIGIN_CEP ?? "",
  };
  const labels =
    shipping &&
    !!sender.name &&
    (!!sender.document || !!sender.companyDocument) &&
    !!sender.phone &&
    !!sender.street &&
    !!sender.number &&
    !!sender.district &&
    !!sender.city &&
    !!sender.state &&
    !!sender.postalCode;
  return {
    enabled,
    payments,
    // Card is paid on the Asaas hosted page: same keys as Pix.
    card: payments,
    // The origin CEP is team data: without it there is no quote at all.
    shipping: shipping && !!raw.SHIPPING_ORIGIN_CEP,
    labels,
    email: !!raw.RESEND_API_KEY && !!raw.EMAIL_FROM,
    environment: raw.ASAAS_ENVIRONMENT,
    paymentsBlockedReason: !enabled
      ? "commerce_disabled"
      : liveBlocked
        ? "live_payments_not_authorized"
        : !raw.ASAAS_API_KEY
          ? "missing_asaas_key"
          : !keyOk
            ? "asaas_key_environment_mismatch"
            : !payments
              ? "missing_webhook_token"
              : null,
    stockFromCms: raw.CURA_STOCK_FROM_CMS === "true",
    siteUrl: raw.SITE_URL?.replace(/\/$/, "") ?? "",
    databaseUrl: raw.DATABASE_URL ?? "",
    orderTokenSecret: raw.ORDER_TOKEN_SECRET ?? "",
    asaas: {
      base: raw.ASAAS_API_BASE ?? ASAAS_BASE[raw.ASAAS_ENVIRONMENT],
      apiKey: raw.ASAAS_API_KEY ?? "",
      webhookToken: raw.ASAAS_WEBHOOK_TOKEN ?? "",
      userAgent: raw.ASAAS_USER_AGENT ?? "Cura Cafe Loja",
    },
    melhorEnvio: {
      base:
        raw.MELHOR_ENVIO_API_BASE ??
        MELHOR_ENVIO_BASE[raw.MELHOR_ENVIO_ENVIRONMENT],
      environment: raw.MELHOR_ENVIO_ENVIRONMENT,
      token: raw.MELHOR_ENVIO_TOKEN ?? "",
      userAgent: raw.MELHOR_ENVIO_USER_AGENT ?? "",
      originCep: raw.SHIPPING_ORIGIN_CEP ?? "",
      sender,
      nonCommercial: raw.SHIPPING_NON_COMMERCIAL === "true",
    },
    resend: {
      base: raw.RESEND_API_BASE,
      apiKey: raw.RESEND_API_KEY ?? "",
      from: raw.EMAIL_FROM ?? "",
    },
    admin: {
      passwordHash: raw.ADMIN_PASSWORD_HASH ?? "",
      sessionSecret: raw.ADMIN_SESSION_SECRET ?? "",
      enabled:
        enabled &&
        !!raw.ADMIN_PASSWORD_HASH &&
        !!raw.ADMIN_SESSION_SECRET &&
        raw.ADMIN_SESSION_SECRET.length >= 32,
    },
    cronSecret: raw.CRON_SECRET ?? "",
  };
}
