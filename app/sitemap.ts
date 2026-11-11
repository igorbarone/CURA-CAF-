import type { MetadataRoute } from "next";
import { getCatalog } from "../lib/coffees";
import { canonical } from "../lib/seo";
import { loadExperience } from "../lib/experience/content";
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
    "experiencia/",
    "experiencia/cafes/",
    "experiencia/origem/",
    "experiencia/aprender/",
    "experiencia/preparar/",
    "experiencia/barista/",
    "experiencia/paladar/",
    ...loadExperience().academy.modules.map((mod) => `experiencia/aprender/${mod.id}/`),
    ...getCatalog().map((entry) => `experiencia/cafes/${entry.coffee.slug}/`),
  ].map((path) => ({ url: canonical(path) }));
}
