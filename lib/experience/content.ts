// Build-time loader for the CURA Experience. Server components only: client
// components receive these already-validated, public objects as props.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCatalog } from "../coffees";
import { toExperienceCoffee } from "./coffee";
import { FLOW_IDS } from "./barista";
import {
  academySchema,
  baristaSchema,
  diagnosisSchema,
  journeySchema,
  methodsSchema,
  tasteSchema,
} from "./schema";

// CURA_CONTENT_ROOT (tests) may hold only catalogue fixtures; the experience's
// editorial files then come from the repository itself.
function read(
  name: string,
  root = process.env.CURA_CONTENT_ROOT ?? process.cwd(),
) {
  const file = join(root, "content/experience", `${name}.json`);
  const source = existsSync(file)
    ? file
    : join(process.cwd(), "content/experience", `${name}.json`);
  return JSON.parse(readFileSync(source, "utf8"));
}

export function loadExperience(root?: string) {
  const methods = methodsSchema.parse(read("methods", root)).methods;
  const academy = academySchema.parse(read("academy", root));
  const journey = journeySchema.parse(read("journey", root));
  const diagnosis = diagnosisSchema.parse(read("diagnosis", root));
  const taste = tasteSchema.parse(read("taste", root));
  const knowledge = baristaSchema.parse(read("barista", root));
  const profiles = new Set(taste.profiles.map((profile) => profile.id));
  const traits = new Set(taste.traits.map((trait) => trait.id));
  for (const question of taste.questions)
    for (const option of question.options) {
      for (const profile of Object.keys(option.points))
        if (!profiles.has(profile))
          throw new Error(`taste: perfil inexistente ${profile}`);
      for (const trait of option.traits)
        if (!traits.has(trait))
          throw new Error(`taste: traço inexistente ${trait}`);
    }
  for (const profile of taste.profiles)
    for (const trait of profile.traits)
      if (!traits.has(trait))
        throw new Error(`taste: traço inexistente ${trait}`);
  const known = new Set<string>([
    ...FLOW_IDS,
    ...knowledge.topics.map((topic) => topic.id),
  ]);
  for (const id of [
    ...knowledge.starters,
    ...knowledge.topics.flatMap((topic) => topic.followUps),
  ])
    if (!known.has(id)) throw new Error(`barista: tópico inexistente ${id}`);
  const optionIds = new Set(diagnosis.options.map((option) => option.id));
  for (const option of diagnosis.options)
    for (const next of option.followUp?.options ?? [])
      if (!optionIds.has(next.to))
        throw new Error(`diagnosis: opção inexistente ${next.to}`);
  const methodIds = new Set(methods.map((method) => method.id));
  for (const option of diagnosis.options)
    for (const item of option.adjustments)
      for (const id of [...(item.methods ?? []), ...(item.notFor ?? [])])
        if (!methodIds.has(id))
          throw new Error(`diagnosis: método inexistente ${id}`);
  return { methods, academy, journey, diagnosis, taste, knowledge };
}

export function getExperienceCoffees() {
  return getCatalog().map(toExperienceCoffee);
}

export function getExperience() {
  return { ...loadExperience(), coffees: getExperienceCoffees() };
}
