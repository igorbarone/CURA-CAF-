import type { MetadataRoute } from "next";
import { getCatalog } from "../lib/coffees";
import { canonical } from "../lib/seo";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "cafes/",
    "descubra/",
    "comparar/",
    "clube/",
    "historia/",
    "empresas/",
    ...getCatalog().map((entry) => `cafes/${entry.coffee.slug}/`),
  ].map((path) => ({ url: canonical(path) }));
}
