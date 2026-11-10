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
// Mercado Pago signs notifications with x-signature "ts=<ts>,v1=<hmac>" over
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" using the webhook secret.
export function verifyMercadoPagoSignature({
  secret,
  signature,
  requestId,
  dataId,
}: {
  secret: string;
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}) {
  if (!secret || !signature || !requestId || !dataId) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqual(expected, parts.v1);
}
export function signMercadoPagoNotification(
  secret: string,
  dataId: string,
  requestId: string,
  ts = String(Date.now()),
) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
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
