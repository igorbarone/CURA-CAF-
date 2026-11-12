// Asaas (API v3): Pix and credit card charges created by the server.
// - Pix: the charge returns a QR Code (image + copy-and-paste payload).
// - Card: the buyer types the card on the Asaas hosted invoice page
//   (invoiceUrl). Card data never passes through or is stored by Cura.
// Every call sends the API key in the `access_token` header; the key lives in
// server environment variables only.
import type { PaymentMethod } from "../pricing";

export type ProviderPayment = {
  id: string;
  // Asaas status: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED,
  // RECEIVED_IN_CASH, REFUND_REQUESTED, CHARGEBACK_REQUESTED, … ; DELETED
  // when the charge was removed.
  status: string;
  amountCents: number;
  // What Asaas keeps after its fee, when reported (indicators only).
  netAmountCents: number | null;
  externalReference: string | null;
  method: PaymentMethod;
  invoiceUrl: string | null;
  pix: { payload: string | null; encodedImage: string | null } | null;
};
export type PaymentRequest = {
  orderId: string;
  amountCents: number;
  description: string;
  method: PaymentMethod;
  // Calendar due date (YYYY-MM-DD, Brasília). Cura expires the order sooner.
  dueDate: string;
  customer: { name: string; email: string; cpf: string; phone: string };
  // Where the hosted page sends the buyer after paying by card.
  successUrl: string;
};
export type PaymentGateway = {
  // Idempotent per order: an existing charge for the order is returned.
  create(request: PaymentRequest): Promise<ProviderPayment>;
  get(id: string): Promise<ProviderPayment>;
  // Removes a pending charge so it can no longer be paid.
  cancel(id: string): Promise<void>;
};
export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}
type Raw = {
  id: string;
  status: string;
  value: number;
  netValue?: number | null;
  externalReference?: string | null;
  billingType: string;
  invoiceUrl?: string | null;
  deleted?: boolean;
};
const methodOf = (billingType: string): PaymentMethod =>
  billingType === "PIX" ? "pix" : "card";
function parse(raw: Raw, pix: ProviderPayment["pix"] = null): ProviderPayment {
  return {
    id: raw.id,
    status: raw.deleted ? "DELETED" : raw.status,
    amountCents: Math.round(raw.value * 100),
    netAmountCents:
      typeof raw.netValue === "number" ? Math.round(raw.netValue * 100) : null,
    externalReference: raw.externalReference ?? null,
    method: methodOf(raw.billingType),
    invoiceUrl: raw.invoiceUrl ?? null,
    pix,
  };
}
export function asaasGateway({
  base,
  apiKey,
  userAgent,
  fetchImpl = fetch,
}: {
  base: string;
  apiKey: string;
  userAgent: string;
  fetchImpl?: typeof fetch;
}): PaymentGateway {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          access_token: apiKey,
          "Content-Type": "application/json",
          "User-Agent": userAgent,
          ...init.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new GatewayError("Asaas indisponível", null);
    }
    if (!response.ok)
      throw new GatewayError(
        `Asaas respondeu ${response.status}`,
        response.status,
      );
    return (await response.json()) as T;
  }
  async function pixOf(id: string) {
    const qr = await call<{ encodedImage?: string; payload?: string }>(
      `/payments/${encodeURIComponent(id)}/pixQrCode`,
    );
    return {
      payload: qr.payload ?? null,
      encodedImage: qr.encodedImage ?? null,
    };
  }
  async function customerId(customer: PaymentRequest["customer"]) {
    const found = await call<{ data: { id: string }[] }>(
      `/customers?cpfCnpj=${customer.cpf}&limit=1`,
    );
    if (found.data[0]) return found.data[0].id;
    const created = await call<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: customer.name,
        cpfCnpj: customer.cpf,
        email: customer.email,
        mobilePhone: customer.phone,
        // Cura sends its own order e-mails; Asaas does not message the buyer.
        notificationDisabled: true,
      }),
    });
    return created.id;
  }
  async function withPix(raw: Raw) {
    return parse(
      raw,
      raw.billingType === "PIX" && !raw.deleted && raw.status === "PENDING"
        ? await pixOf(raw.id)
        : null,
    );
  }
  return {
    async create(request) {
      // Asaas has no idempotency header: the order id is the charge's
      // externalReference, so a retry after a lost response finds it.
      const existing = await call<{ data: Raw[] }>(
        `/payments?externalReference=${encodeURIComponent(request.orderId)}&limit=10`,
      );
      const billingType = request.method === "pix" ? "PIX" : "CREDIT_CARD";
      const reuse = existing.data.find(
        (raw) => !raw.deleted && raw.billingType === billingType,
      );
      if (reuse) return withPix(reuse);
      const raw = await call<Raw>("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: await customerId(request.customer),
          billingType,
          value: request.amountCents / 100,
          dueDate: request.dueDate,
          description: request.description,
          externalReference: request.orderId,
          ...(request.method === "card"
            ? {
                callback: {
                  successUrl: request.successUrl,
                  autoRedirect: true,
                },
              }
            : {}),
        }),
      });
      return withPix(raw);
    },
    async get(id) {
      try {
        return await withPix(
          await call<Raw>(`/payments/${encodeURIComponent(id)}`),
        );
      } catch (error) {
        // A removed charge may answer 404: report it as deleted.
        if (error instanceof GatewayError && error.status === 404)
          return {
            id,
            status: "DELETED",
            amountCents: 0,
            netAmountCents: null,
            externalReference: null,
            method: "pix",
            invoiceUrl: null,
            pix: null,
          };
        throw error;
      }
    },
    async cancel(id) {
      await call(`/payments/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
// Asaas status → financial order status. Only the server, reading Asaas,
// ever decides that an order is paid.
export function financialStatus(status: string) {
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(status))
    return "paid" as const;
  if (status === "OVERDUE") return "expired" as const;
  if (status === "DELETED") return "cancelled" as const;
  if (status === "REFUNDED") return "refunded" as const;
  return null;
}
