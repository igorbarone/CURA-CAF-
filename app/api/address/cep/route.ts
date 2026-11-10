import { lookupCep } from "../../../../lib/commerce/server/cep";
import { handle, json } from "../../../../lib/commerce/server/runtime";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handle(request, "cep", 30, async () => {
    const cep = new URL(request.url).searchParams.get("cep") ?? "";
    try {
      const address = await lookupCep(cep);
      return address ? json(address) : json({ error: "cep_not_found" }, 404);
    } catch {
      return json({ error: "cep_unavailable" }, 503);
    }
  });
}
