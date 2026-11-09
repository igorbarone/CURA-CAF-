import { handleMercadoPagoNotification } from "../../../../lib/commerce/server/orders";
import { log } from "../../../../lib/commerce/server/log";
import { handle, json, runtime } from "../../../../lib/commerce/server/runtime";
import { verifyMercadoPagoSignature } from "../../../../lib/commerce/server/security";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return handle(request, "webhook", 300, async () => {
    const { deps, config } = await runtime();
    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      data?: { id?: string | number };
    };
    const dataId =
      url.searchParams.get("data.id") ??
      (body.data?.id != null ? String(body.data.id) : null);
    const requestId = request.headers.get("x-request-id");
    if (
      !verifyMercadoPagoSignature({
        secret: config.mp.webhookSecret,
        signature: request.headers.get("x-signature"),
        requestId,
        dataId,
      })
    ) {
      log("webhook.rejected_signature", {});
      return json({ error: "invalid_signature" }, 401);
    }
    const result = await handleMercadoPagoNotification(deps, {
      requestId: requestId!,
      type: url.searchParams.get("type") ?? body.type ?? null,
      dataId: dataId!,
    });
    return json(result);
  });
}
