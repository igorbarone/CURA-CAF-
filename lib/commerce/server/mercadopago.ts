// Mercado Pago Checkout Transparente (API de pagamentos v1). Card data never
// reaches this server: the browser's Card Payment Brick turns it into a
// one-time token, and only that token is sent here.
export type ProviderPayment = {
  id: string;
  status: string;
  statusDetail: string | null;
  amountCents: number;
  externalReference: string | null;
  method: string;
  pix: {
    qrCode: string | null;
    qrCodeBase64: string | null;
    ticketUrl: string | null;
  } | null;
  expiresAt: string | null;
};
export type Payer = {
  email: string;
  firstName: string;
  lastName: string;
  cpf: string;
};
export type PaymentRequest = {
  orderId: string;
  amountCents: number;
  description: string;
  payer: Payer;
  notificationUrl: string;
} & (
  | { method: "pix"; expiresAt: Date }
  | {
      method: "card";
      token: string;
      paymentMethodId: string;
      installments: number;
      issuerId: string | null;
    }
);
export type PaymentGateway = {
  create(request: PaymentRequest): Promise<ProviderPayment>;
  get(id: string): Promise<ProviderPayment>;
};
export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}
// date_of_expiration in Brasília time, the format Mercado Pago documents.
export function brasiliaIso(date: Date) {
  const local = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 23)}-03:00`;
}
type Raw = {
  id: number | string;
  status: string;
  status_detail?: string | null;
  transaction_amount: number;
  external_reference?: string | null;
  payment_method_id: string;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};
function parse(raw: Raw): ProviderPayment {
  const pix = raw.point_of_interaction?.transaction_data;
  return {
    id: String(raw.id),
    status: raw.status,
    statusDetail: raw.status_detail ?? null,
    amountCents: Math.round(raw.transaction_amount * 100),
    externalReference: raw.external_reference ?? null,
    method: raw.payment_method_id,
    pix:
      raw.payment_method_id === "pix"
        ? {
            qrCode: pix?.qr_code ?? null,
            qrCodeBase64: pix?.qr_code_base64 ?? null,
            ticketUrl: pix?.ticket_url ?? null,
          }
        : null,
    expiresAt: raw.date_of_expiration ?? null,
  };
}
export function mercadoPagoGateway({
  base,
  accessToken,
  fetchImpl = fetch,
}: {
  base: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): PaymentGateway {
  async function call(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new GatewayError("Mercado Pago indisponível", null);
    }
    if (!response.ok)
      throw new GatewayError(
        `Mercado Pago respondeu ${response.status}`,
        response.status,
      );
    return parse((await response.json()) as Raw);
  }
  return {
    create(request) {
      const common = {
        transaction_amount: request.amountCents / 100,
        description: request.description,
        external_reference: request.orderId,
        notification_url: request.notificationUrl,
        statement_descriptor: "CURA CAFE",
        payer: {
          email: request.payer.email,
          first_name: request.payer.firstName,
          last_name: request.payer.lastName,
          identification: { type: "CPF", number: request.payer.cpf },
        },
      };
      const body =
        request.method === "pix"
          ? {
              ...common,
              payment_method_id: "pix",
              date_of_expiration: brasiliaIso(request.expiresAt),
            }
          : {
              ...common,
              token: request.token,
              payment_method_id: request.paymentMethodId,
              installments: request.installments,
              ...(request.issuerId ? { issuer_id: request.issuerId } : {}),
            };
      // The order id makes a repeated request return the same payment.
      return call("/v1/payments", {
        method: "POST",
        headers: { "X-Idempotency-Key": request.orderId },
        body: JSON.stringify(body),
      });
    },
    get: (id) => call(`/v1/payments/${encodeURIComponent(id)}`),
  };
}
