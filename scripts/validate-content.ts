import { getEditorial } from "../lib/editorial";
import { loadContent } from "../lib/content-loader";
const content = loadContent();
getEditorial();
console.log(
  `Conteúdo válido: ${content.coffees.length} cafés, ${content.lots.length} lotes, ${content.offers.length} ofertas. Nenhuma publicação foi executada.`,
);
