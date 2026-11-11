import { readConfig } from "../../../../lib/commerce/server/config";
import { json } from "../../../../lib/commerce/server/runtime";
export const dynamic = "force-dynamic";
// What the storefront may offer right now. Nothing secret is returned.
export function GET() {
  const config = readConfig();
  return json({
    enabled: config.enabled,
    pix: config.payments,
    card: config.card,
    shipping: config.shipping,
    environment: config.environment,
  });
}
