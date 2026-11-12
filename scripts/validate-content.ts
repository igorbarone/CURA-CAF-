import { getCommerceRules } from "../lib/commerce/rules";
import { sellabilityIssues } from "../lib/commerce/catalog";
import { getEditorial } from "../lib/editorial";
import { loadContent } from "../lib/content-loader";
import { getContact } from "../lib/contact";
import { loadExperience } from "../lib/experience/content";
const content = loadContent();
getEditorial();
const experience = loadExperience();
const channels = Object.values(getContact()).filter(Boolean).length;
const lessons = experience.academy.modules.reduce(
  (sum, module) => sum + module.lessons.length,
  0,
);
console.log(
  `Conteúdo válido: ${content.coffees.length} cafés, ${content.lots.length} lotes, ${content.offers.length} ofertas, ${channels} canais de contato. Experience: ${experience.methods.length} métodos, ${lessons} lições, ${experience.knowledge.topics.length} tópicos do Barista. Nenhuma publicação foi executada.`,
);
// Publication checklist: published offers that are not sellable yet, and why.
// Drafts may stay incomplete and are not listed.
getCommerceRules();
{
  const blocked = content.offers
    .filter((offer) => offer.status === "published")
    .map((offer) => ({ offer, issues: sellabilityIssues(content, offer) }))
    .filter((entry) => entry.issues.length);
  for (const { offer, issues } of blocked)
    console.log(
      `  ⚠ ${offer.sku}: fora da venda online (${issues.join(", ")})`,
    );
}
