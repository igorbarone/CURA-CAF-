import {
  canReadOrder,
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
    const view = await orderView(deps, id);
    return view ? json(view) : json({ error: "not_found" }, 404);
  });
}
