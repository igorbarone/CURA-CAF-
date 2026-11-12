// Operations panel authentication: one team password (stored only as a
// scrypt hash in ADMIN_PASSWORD_HASH) and a signed, expiring, HttpOnly
// session cookie. Forms are same-origin only (Origin check + SameSite).
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { safeEqual } from "./security";

export const ADMIN_COOKIE = "cura_admin";
const SESSION_HOURS = 8;
export function hashPassword(password: string, salt = randomBytes(16)) {
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash || !password) return false;
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), 32);
  return safeEqual(actual.toString("base64url"), hash);
}
const sign = (secret: string, payload: string) =>
  createHmac("sha256", secret).update(`admin:${payload}`).digest("base64url");
export function createSession(secret: string, now = Date.now()) {
  const payload = `${now + SESSION_HOURS * 3600_000}.${randomBytes(8).toString("base64url")}`;
  return `${payload}.${sign(secret, payload)}`;
}
export function validSession(
  secret: string,
  value: string | undefined,
  now = Date.now(),
) {
  if (!secret || !value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return safeEqual(sign(secret, payload), parts[2]) && Number(parts[0]) > now;
}
export const sessionCookie = (value: string, secure: boolean) =>
  `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure ? "; Secure" : ""}`;
export const clearCookie = (secure: boolean) =>
  `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
// Same-origin check for state-changing requests.
export function sameOrigin(request: Request, siteUrl: string) {
  const origin = request.headers.get("origin");
  const own = new URL(request.url).origin;
  return !origin || origin === own || origin === siteUrl;
}
