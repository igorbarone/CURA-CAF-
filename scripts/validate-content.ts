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
