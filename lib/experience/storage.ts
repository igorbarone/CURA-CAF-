// Per-visitor conveniences kept in this browser only (no account, no server).
// Every access is guarded: private windows and blocked storage simply forget.
export const STORAGE = {
  coffee: "cura-experience-coffee",
  brew: "cura-experience-brew",
  level: "cura-experience-level",
} as const;
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* not remembered */
  }
}
