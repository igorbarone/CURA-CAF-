import { loadContent } from "../../content-loader";
import { buildPriceBook } from "../catalog";
import { getCommerceRules } from "../rules";
import { readConfig } from "./config";
import { migrate, openDb } from "./db";
import { log } from "./log";
import { asaasGateway } from "./asaas";
import type { LabelDeps } from "./labels";
import { resendNotifier, skippedNotifier } from "./notify";
import { CheckoutError, seedStockFromContent } from "./orders";
import { rateLimit } from "./security";
import { melhorEnvioGateway } from "./shipping";
// One set of dependencies per server process, built from env + CMS content.
let cached: Promise<{
  deps: LabelDeps;
  config: ReturnType<typeof readConfig>;
}> | null = null;
export function runtime() {
  cached ??= (async () => {
    const config = readConfig();
    if (!config.enabled) throw new CheckoutError("payment_unavailable", 503);
    const db = await openDb(config.databaseUrl);
    if (
      config.databaseUrl.startsWith("pglite:") ||
      process.env.CURA_AUTO_MIGRATE === "true"
    )
      await migrate(db);
    const content = loadContent();
    if (config.stockFromCms)
      log("stock.seeded_from_cms", {
        skus: await seedStockFromContent(db, content.offers),
      });
    const deps: LabelDeps = {
      db,
      book: buildPriceBook(content),
      rules: getCommerceRules(),
      siteUrl: config.siteUrl,
      tokenSecret: config.orderTokenSecret,
      ...gateways(config),
      notifier: config.email ? resendNotifier(config.resend) : skippedNotifier,
    };
    log("commerce.ready", {
      payments: config.payments,
      card: config.card,
      shipping: config.shipping,
      labels: config.labels,
      email: config.email,
      environment: config.environment,
    });
    return { deps, config };
  })();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}
// Provider clients for a configuration; an unconfigured provider answers
// "unavailable" instead of pretending.
export function gateways(config: ReturnType<typeof readConfig>) {
  const unavailable = async (): Promise<never> => {
    throw new CheckoutError("payment_unavailable", 503);
  };
  const noShipping = async (): Promise<never> => {
    throw new CheckoutError("shipping_unavailable", 503);
  };
  return {
    payments: config.payments
      ? asaasGateway(config.asaas)
      : { create: unavailable, get: unavailable, cancel: unavailable },
    shipping: config.shipping
      ? melhorEnvioGateway(config.melhorEnvio)
      : {
          quote: noShipping,
          addToCart: noShipping,
          checkout: noShipping,
          generate: noShipping,
          print: noShipping,
          tracking: noShipping,
        },
    labels: config.labels
      ? {
          sender: config.melhorEnvio.sender,
          nonCommercial: config.melhorEnvio.nonCommercial,
        }
      : null,
  };
}
export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
// Wraps a route: rate limit per client, size limit, error → JSON response.
export async function handle(
  request: Request,
  name: string,
  limit: number,
  fn: () => Promise<Response>,
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  // CURA_RATE_LIMIT_SCALE only exists for automated tests that run many
  // purchases from one address; production keeps the limits below.
  const scale = Number(process.env.CURA_RATE_LIMIT_SCALE ?? 1) || 1;
  if (!rateLimit(`${name}:${ip}`, limit * scale, 60_000))
    return json({ error: "rate_limited" }, 429);
  if (Number(request.headers.get("content-length") ?? 0) > 32_000)
    return json({ error: "payload_too_large" }, 413);
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CheckoutError)
      return json({ error: error.code, ...error.details }, error.status);
    log("api.error", {
      route: name,
      message: error instanceof Error ? error.message : "unknown",
    });
    return json({ error: "internal_error" }, 500);
  }
}
export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new CheckoutError("invalid_input", 400);
  }
}
