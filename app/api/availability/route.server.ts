import { availability } from "../../../lib/commerce/server/orders";
import { handle, json, runtime } from "../../../lib/commerce/server/runtime";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handle(request, "availability", 120, async () => {
    const { deps } = await runtime();
    const ids = (new URL(request.url).searchParams.get("ids") ?? "")
      .split(",")
      .filter(Boolean)
      .slice(0, 40);
    return json({ units: await availability(deps, ids) });
  });
}
