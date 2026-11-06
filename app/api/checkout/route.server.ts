import { createCheckout } from "../../../lib/commerce/server/orders";
import {
  handle,
  json,
  readJson,
  runtime,
} from "../../../lib/commerce/server/runtime";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return handle(request, "checkout", 10, async () => {
    const { deps, config } = await runtime();
    if (!config.payments) return json({ error: "payment_unavailable" }, 503);
    return json(await createCheckout(deps, await readJson(request)), 201);
  });
}
