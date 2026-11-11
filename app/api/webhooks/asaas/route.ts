import { handleAsaasWebhook } from "../../../../lib/commerce/server/orders";
import { log } from "../../../../lib/commerce/server/log";
import { handle, json, runtime } from "../../../../lib/commerce/server/runtime";
import {
  sha256,
  verifyWebhookToken,
} from "../../../../lib/commerce/server/security";
export const dynamic = "force-dynamic";
// Asaas webhook (configure in Asaas: URL /api/webhooks/asaas/, API v3,
// payment events, the same token as ASAAS_WEBHOOK_TOKEN). Answers 200 for
// anything handled or deliberately ignored, so Asaas does not pause the
// queue; 401 for a wrong token; 5xx only when a retry should happen.
export function POST(request: Request) {
  return handle(request, "webhook", 300, async () => {
    const { deps, config } = await runtime();
    if (
      !verifyWebhookToken(
        config.asaas.webhookToken,
        request.headers.get("asaas-access-token"),
      )
    ) {
      log("webhook.rejected_token", {});
      return json({ error: "invalid_token" }, 401);
    }
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      event?: string;
      payment?: { id?: string; status?: string };
    };
    const event = typeof body.event === "string" ? body.event : "";
    const paymentId =
      typeof body.payment?.id === "string" ? body.payment.id : null;
    // Asaas sends a unique event id; older payloads without it are keyed by
    // their content, so an identical repeat is still recognised.
    const eventId =
      typeof body.id === "string" && body.id
        ? body.id
        : `sha:${sha256(JSON.stringify([event, paymentId, body.payment?.status]))}`;
    return json(await handleAsaasWebhook(deps, { eventId, event, paymentId }));
  });
}
