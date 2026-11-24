import type { MetadataRoute } from "next";
import { canonical } from "../lib/seo";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/carrinho/", "/admin/"],
    },
    sitemap: canonical("sitemap.xml"),
  };
}
