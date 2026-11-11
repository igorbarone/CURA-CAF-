import { requestHasSession } from "../../../../lib/commerce/server/admin";
import { sameOrigin } from "../../../../lib/commerce/server/admin-auth";
import { loadContent } from "../../../../lib/content-loader";
import {
  buyLabel,
  refreshTracking,
} from "../../../../lib/commerce/server/labels";
import { log } from "../../../../lib/commerce/server/log";
import {
  advanceFulfillment,
  CheckoutError,
  reconcile,
} from "../../../../lib/commerce/server/orders";
import { handle, runtime } from "../../../../lib/commerce/server/runtime";
import {
  adjustStock,
  setPaused,
  StockError,
} from "../../../../lib/commerce/server/stock";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const back = (path: string, key: "ok" | "erro", message: string) =>
  new Response(null, {
    status: 303,
    headers: {
      Location: `${path}${path.includes("?") ? "&" : "?"}${key}=${message}`,
    },
  });
// Every panel action: a plain HTML form post, checked for session and
// origin, then redirected back with a fixed message key.
export function POST(request: Request) {
  return handle(request, "admin-action", 60, async () => {
    const { deps, config } = await runtime();
    if (!sameOrigin(request, config.siteUrl) || !requestHasSession(request))
      return back("/admin/", "erro", "sessao");
    const form = await request.formData();
    const field = (name: string) => String(form.get(name) ?? "").trim();
    const action = field("action");
    const returnTo = field("back").startsWith("/admin/")
      ? field("back")
      : "/admin/";
    const orderId = field("orderId");
    if (action.startsWith("order.") && !UUID.test(orderId))
      return back(returnTo, "erro", "not_found");
    const skus = loadContent().offers.map((offer) => offer.sku);
    try {
      switch (action) {
        case "order.prepare":
          await advanceFulfillment(deps, orderId, "preparing");
          return back(returnTo, "ok", "preparing");
        case "order.ship":
          await advanceFulfillment(deps, orderId, "shipped", {
            code: field("tracking"),
            carrier: field("carrier") || null,
          });
          return back(returnTo, "ok", "shipped");
        case "order.deliver":
          await advanceFulfillment(deps, orderId, "delivered");
          return back(returnTo, "ok", "delivered");
        case "order.label": {
          const key = field("invoiceKey").replace(/\D/g, "");
          if (key && key.length !== 44)
            return back(returnTo, "erro", "invalid_input");
          await buyLabel(deps, orderId, { invoiceKey: key || null });
          return back(returnTo, "ok", "label");
        }
        case "order.tracking":
          await refreshTracking(deps, orderId);
          return back(returnTo, "ok", "tracking");
        case "stock.set":
          await adjustStock(
            deps.db,
            {
              sku: field("sku"),
              set: Number(field("quantity")),
              reason: field("reason"),
              actor: "painel",
            },
            skus,
          );
          return back(returnTo, "ok", "stock");
        case "stock.pause":
        case "stock.resume":
          await setPaused(
            deps.db,
            field("sku"),
            action === "stock.pause",
            "painel",
            skus,
          );
          return back(
            returnTo,
            "ok",
            action === "stock.pause" ? "paused" : "resumed",
          );
        case "orders.reconcile":
          await reconcile(deps);
          return back(returnTo, "ok", "reconcile");
        default:
          return back(returnTo, "erro", "erro");
      }
    } catch (error) {
      if (error instanceof CheckoutError)
        return back(returnTo, "erro", error.code);
      if (error instanceof StockError)
        return back(returnTo, "erro", "stock_error");
      log("admin.action_failed", {
        action,
        message: error instanceof Error ? error.message : "unknown",
      });
      return back(returnTo, "erro", "erro");
    } finally {
      log("admin.action", { action, orderId: orderId || null });
    }
  });
}
