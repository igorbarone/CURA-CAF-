import { createHash, createHmac, timingSafeEqual } from "node:crypto";
// Order access tokens are derived, not stored: HMAC(secret, order id). The
// link sent to the buyer is the only way to read an order without an account.
export function orderToken(secret: string, orderId: string) {
  return createHmac("sha256", secret)
    .update(`order:${orderId}`)
    .digest("base64url");
}
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
// Asaas authenticates webhooks with the token chosen when the webhook was
// created, sent back in the `asaas-access-token` header. Compared in
// constant time; an empty secret never matches.
export function verifyWebhookToken(expected: string, received: string | null) {
  return !!expected && !!received && safeEqual(expected, received);
}
// CPF validation lives with the client-safe helpers (used by the checkout form).
export { isValidCpf } from "../format";
// Fixed-window limiter per key. In-memory, so it guards one server instance;
// a multi-instance deploy needs a shared store (see the architecture doc).
const windows = new Map<string, { start: number; count: number }>();
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const current = windows.get(key);
  if (!current || now - current.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}
