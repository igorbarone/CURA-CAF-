import type { CatalogEntry } from "./catalog-model";
import { projectCoffee } from "./catalog-model";
export type QuizAnswers = {
  profile: string;
  preparation: string;
  roast: string;
};
export function recommendCoffees(
  entries: CatalogEntry[],
  answers: QuizAnswers,
) {
  if (!answers.profile && !answers.preparation && !answers.roast) return [];
  return entries
    .filter((entry) => entry.coffee.status === "published")
    .flatMap((entry) => {
      const matches = entry.lots.filter(
        (lot) =>
          lot.status === "published" &&
          (!answers.profile || lot.profile === answers.profile) &&
          (!answers.preparation ||
            lot.preparations.includes(answers.preparation)) &&
          (!answers.roast || lot.roast === answers.roast),
      );
      if (!matches.length) return [];
      const lot =
        matches.find((lot) => lot.id === entry.coffee.primaryLotId) ??
        matches[0];
      const reasons = [
        answers.profile ? `Perfil confirmado: ${lot.profile}.` : null,
        answers.preparation
          ? `Preparo sugerido: ${answers.preparation}.`
          : null,
        answers.roast
          ? `Torra confirmada: ${answers.roast.toLowerCase()}.`
          : null,
      ].filter((reason): reason is string => !!reason);
      return [{ coffee: projectCoffee(entry, lot.id), lotId: lot.id, reasons }];
    });
}
