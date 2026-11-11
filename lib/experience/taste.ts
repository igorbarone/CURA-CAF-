// "Descubra seu paladar": preference profile + recommendation. The profile is
// a preference, never a scientific class. Coffees are matched only through
// attributes published on their lots (keyword rules in content/experience/
// taste.json), so a new coffee is recommended without code changes and a
// coffee with empty fields is never credited with a trait it does not show.
import type { ExperienceCoffee } from "./coffee";
import type { Taste } from "./schema";

export type TasteAnswers = Record<string, string>;
const normalize = (value: string) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

function fieldValues(
  coffee: ExperienceCoffee,
  field: Taste["traits"][number]["fields"][number],
): string[] {
  switch (field) {
    case "profile":
      return coffee.profile ? [coffee.profile] : [];
    case "notes":
      return coffee.sensory?.notes ?? [];
    case "acidity":
      return coffee.sensory?.acidity ? [coffee.sensory.acidity] : [];
    case "body":
      return coffee.sensory?.body ? [coffee.sensory.body] : [];
    case "roast":
      return coffee.roast ? [coffee.roast] : [];
    case "preparations":
      return coffee.preparations;
  }
}
const fieldLabel: Record<string, string> = {
  profile: "Perfil",
  notes: "Notas",
  acidity: "Acidez",
  body: "Corpo",
  roast: "Torra",
  preparations: "Preparo sugerido",
};

/** Trait evidence found in a coffee's published attributes. */
export function coffeeTraits(coffee: ExperienceCoffee, taste: Taste) {
  return taste.traits.flatMap((trait) => {
    for (const field of trait.fields)
      for (const value of fieldValues(coffee, field))
        if (
          trait.keywords.some((keyword) =>
            normalize(value).includes(normalize(keyword)),
          )
        )
          return [
            {
              trait: trait.id,
              label: trait.label,
              evidence: `${fieldLabel[field]}: ${value}`,
            },
          ];
    return [];
  });
}

export function tasteProfile(taste: Taste, answers: TasteAnswers) {
  const scores = new Map(taste.profiles.map((profile) => [profile.id, 0]));
  const wanted = new Map<string, number>();
  for (const question of taste.questions) {
    const option = question.options.find(
      (item) => item.id === answers[question.id],
    );
    if (!option) continue;
    for (const [profile, points] of Object.entries(option.points))
      if (scores.has(profile))
        scores.set(profile, (scores.get(profile) ?? 0) + points);
    for (const trait of option.traits)
      wanted.set(trait, (wanted.get(trait) ?? 0) + 1);
  }
  const answered = taste.questions.filter(
    (question) => answers[question.id],
  ).length;
  if (!answered) return null;
  // Ties keep the editorial order of the profiles.
  const profile = taste.profiles.reduce((best, item) =>
    (scores.get(item.id) ?? 0) > (scores.get(best.id) ?? 0) ? item : best,
  );
  for (const trait of profile.traits)
    wanted.set(trait, (wanted.get(trait) ?? 0) + 1);
  return { profile, wanted, answered };
}

export function recommendByTaste(
  coffees: ExperienceCoffee[],
  taste: Taste,
  answers: TasteAnswers,
  limit = 2,
) {
  const result = tasteProfile(taste, answers);
  if (!result) return { profile: null, recommendations: [] };
  const recommendations = coffees
    .map((coffee, order) => {
      const matches = coffeeTraits(coffee, taste).filter((item) =>
        result.wanted.has(item.trait),
      );
      const score = matches.reduce(
        (sum, item) => sum + (result.wanted.get(item.trait) ?? 0),
        0,
      );
      return { coffee, score, order, reasons: matches };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ coffee, reasons, score }) => ({ coffee, reasons, score }));
  return { profile: result.profile, recommendations };
}
