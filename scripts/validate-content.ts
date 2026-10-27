import { getEditorial } from "../lib/editorial";
import { loadContent } from "../lib/content-loader";
import { getContact } from "../lib/contact";
const content = loadContent();
getEditorial();
const channels = Object.values(getContact()).filter(Boolean).length;
console.log(
  `Conteúdo válido: ${content.coffees.length} cafés, ${content.lots.length} lotes, ${content.offers.length} ofertas, ${channels} canais de contato. Nenhuma publicação foi executada.`,
);
