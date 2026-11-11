import { reconcile } from "../../../../lib/commerce/server/orders";
import { handle, json, runtime } from "../../../../lib/commerce/server/runtime";
import { verifyWebhookToken } from "../../../../lib/commerce/server/security";
export const dynamic = "force-dynamic";
// Safety net run by a scheduler (Vercel Cron sends "Authorization: Bearer
// <CRON_SECRET>"): re-reads pending charges and expires overdue orders.
export function GET(request: Request) {
  return handle(request, "cron", 10, async () => {
    const { deps, config } = await runtime();
    const auth = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!verifyWebhookToken(config.cronSecret, auth ?? null))
      return json({ error: "unauthorized" }, 401);
    const result = await reconcile(deps);
    return json({
      synced: Object.keys(result.synced).length,
      expired: Object.keys(result.expired).length,
    });
  });
}
