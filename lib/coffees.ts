import { loadContent } from "./content-loader";
import {
  featuredCatalog,
  publicProduct,
  publishedCatalog,
  publicProductRoutes,
} from "./catalog-model";
// Only server pages import this adapter; browser components receive public projections.
export function getCatalog() {
  return publishedCatalog(loadContent());
}
export function getProduct(slug: string) {
  return publicProduct(loadContent(), slug);
}
export function getHomeSelection() {
  const content = loadContent();
  return { settings: content.home, entries: featuredCatalog(content) };
}
export function getProductRoutes() {
  return publicProductRoutes(loadContent());
}
