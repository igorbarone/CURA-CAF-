import { quoteShipping } from "../../../../lib/commerce/server/orders";
import {
  handle,
  json,
  readJson,
  runtime,
} from "../../../../lib/commerce/server/runtime";
export const dynamic = "force-dynamic";
export function POST(request: Request) {
  return handle(request, "shipping", 30, async () => {
    const { deps } = await runtime();
    const body = await readJson(request);
    return json(
      await quoteShipping(deps, {
        cep: String(body?.cep ?? ""),
        lines: body?.lines,
      }),
    );
  });
}
