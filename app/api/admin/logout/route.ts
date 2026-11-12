import { clearCookie } from "../../../../lib/commerce/server/admin-auth";
import { readConfig } from "../../../../lib/commerce/server/config";
export const dynamic = "force-dynamic";
export function POST() {
  const secure = readConfig().siteUrl.startsWith("https://");
  return new Response(null, {
    status: 303,
    headers: { Location: "/admin/", "Set-Cookie": clearCookie(secure) },
  });
}
