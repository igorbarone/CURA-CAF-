// CURA Experience events, pushed to window.dataLayer next to the e-commerce
// funnel (lib/analytics.ts). No analytics script is loaded by the site: a tag
// manager is added only after the LGPD consent banner exists. Parameters are
// never personal data: ids of coffees/methods/content, counts and the entry
// source only. Free text typed in the Barista is never sent.
export type ExperienceEvent =
  | "experience_open"
  | "experience_start"
  | "coffee_select"
  | "content_view"
  | "method_select"
  | "recipe_generate"
  | "tutorial_complete"
  | "timer_start"
  | "diagnosis_select"
  | "barista_message"
  | "quiz_complete"
  | "product_click";

type Params = Record<string, string | number | boolean | undefined>;
const SOURCE_KEY = "cura-experience-source";

export function trackExperience(event: ExperienceEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  const target = window as unknown as { dataLayer?: unknown[] };
  target.dataLayer ??= [];
  target.dataLayer.push({
    event,
    experience: { source: entrySource() ?? "direto", ...params },
  });
}

/** Remembers, for this tab only, that the visit started from the package QR. */
export function rememberEntrySource(search: string) {
  const params = new URLSearchParams(search);
  const source =
    params.get("origem") ?? (params.get("utm_medium") === "qr" ? "qr" : null);
  if (source !== "qr") return entrySource();
  try {
    sessionStorage.setItem(SOURCE_KEY, "qr");
  } catch {
    /* storage blocked: attribution is simply not kept */
  }
  return "qr";
}
export function entrySource() {
  try {
    return typeof window === "undefined"
      ? null
      : sessionStorage.getItem(SOURCE_KEY);
  } catch {
    return null;
  }
}

/**
 * Commerce links keep the regular product route (no parallel checkout) and,
 * for QR visits, carry UTM parameters so a later purchase can be attributed.
 */
export function productHref(path: string, source = entrySource()) {
  if (source !== "qr") return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}utm_source=embalagem&utm_medium=qr&utm_campaign=cura-experience`;
}
