import {
  canReadOrder,
  expireOrder,
  orderView,
} from "../../../../lib/commerce/server/orders";
import { handle, json, runtime } from "../../../../lib/commerce/server/runtime";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(request, "order", 60, async () => {
    const { id } = await params;
    const { deps } = await runtime();
    const token = new URL(request.url).searchParams.get("token");
    // Same answer for "no such order" and "wrong token": nothing to probe.
    if (!UUID.test(id) || !canReadOrder(deps, id, token))
      return json({ error: "not_found" }, 404);
    let view = await orderView(deps, id);
    // The buyer's own page expires an order whose deadline passed (the
    // scheduled reconciliation does the same for everyone else).
    if (
      view?.financialStatus === "pending_payment" &&
      view.expiresAt &&
      new Date(view.expiresAt) < new Date()
    ) {
      await expireOrder(deps, id).catch(() => null);
      view = await orderView(deps, id);
    }
    return view ? json(view) : json({ error: "not_found" }, 404);
  });
}
