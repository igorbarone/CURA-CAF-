// Structured logs without personal data or secrets: sensitive keys are
// replaced before anything reaches stdout.
const SENSITIVE =
  /^(email|cpf|name|firstName|lastName|phone|address|street|number|complement|token|accessToken|authorization|qrCode|qrCodeBase64|identification|payer)$/i;
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE.test(key) ? "[redacted]" : redact(item),
      ]),
    );
  return value;
}
export function log(event: string, data: Record<string, unknown> = {}) {
  if (process.env.CURA_LOG === "silent") return;
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      event,
      ...(redact(data) as object),
    }),
  );
}
