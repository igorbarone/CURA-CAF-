import {
  clearCookie,
  createSession,
  sameOrigin,
  sessionCookie,
  verifyPassword,
} from "../../../../lib/commerce/server/admin-auth";
import { readConfig } from "../../../../lib/commerce/server/config";
import { log } from "../../../../lib/commerce/server/log";
import { handle } from "../../../../lib/commerce/server/runtime";
export const dynamic = "force-dynamic";
const redirect = (to: string, cookie?: string) =>
  new Response(null, {
    status: 303,
    headers: { Location: to, ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });
// Team password → signed session cookie. Five attempts a minute per address.
export function POST(request: Request) {
  return handle(request, "admin-login", 5, async () => {
    const config = readConfig();
    const secure = config.siteUrl.startsWith("https://");
    if (!config.admin.enabled || !sameOrigin(request, config.siteUrl))
      return redirect("/admin/?erro=erro", clearCookie(secure));
    const form = await request.formData().catch(() => null);
    const password = String(form?.get("password") ?? "");
    if (!verifyPassword(password, config.admin.passwordHash)) {
      log("admin.login_failed", {});
      return redirect("/admin/?erro=senha", clearCookie(secure));
    }
    log("admin.login", {});
    return redirect(
      "/admin/",
      sessionCookie(createSession(config.admin.sessionSecret), secure),
    );
  });
}
