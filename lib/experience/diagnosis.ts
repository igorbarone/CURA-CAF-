// Post-brew diagnosis. Suggestions are ordered: method-specific advice first,
// then general advice for variables the method-specific advice did not cover.
// The UI always presents them one at a time ("mude uma variável por vez").
import type { Diagnosis } from "./schema";

export function diagnose(
  diagnosis: Diagnosis,
  optionId: string,
  methodId?: string,
) {
  const option = diagnosis.options.find((item) => item.id === optionId);
  if (!option) return null;
  const specific = option.adjustments.filter(
    (item) => item.methods && methodId && item.methods.includes(methodId),
  );
  const covered = new Set(specific.map((item) => item.variable));
  const general = option.adjustments.filter(
    (item) =>
      !item.methods &&
      !(methodId && item.notFor?.includes(methodId)) &&
      (item.variable === "nenhuma" || !covered.has(item.variable)),
  );
  const adjustments = [...specific, ...general];
  return {
    id: option.id,
    label: option.label,
    summary: option.summary,
    checks: option.checks,
    followUp: option.followUp ?? null,
    first: adjustments[0] ?? null,
    then: adjustments.slice(1),
    oneVariable: diagnosis.oneVariable,
  };
}
export type DiagnosisResult = NonNullable<ReturnType<typeof diagnose>>;
