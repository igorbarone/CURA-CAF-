// Local stand-ins for Mercado Pago, Melhor Envio and Resend, used only by the
// commerce end-to-end tests. They speak the same HTTP shapes the real clients
// use, and can send signed payment notifications back to the store.
import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { signMercadoPagoNotification } from "../../lib/commerce/server/security";

type Payment = Record<string, unknown> & { id: number; status: string };
export function startMockProviders({
  port,
  storeUrl,
  webhookSecret,
}: {
  port: number;
  storeUrl: string;
  webhookSecret: string;
}) {
  const payments = new Map<number, Payment>();
  const emails: { to: string[]; subject: string }[] = [];
  const shippingCalls: unknown[] = [];
  let failNextPayment = 0;
  let sequence = 5000;
  const body = (request: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve) => {
      let raw = "";
      request.on("data", (chunk) => (raw += chunk));
      request.on("end", () => resolve(raw ? JSON.parse(raw) : {}));
    });
  async function notify(id: number, requestId: string = randomUUID()) {
    const response = await fetch(
      `${storeUrl}/api/webhooks/mercadopago/?data.id=${id}&type=payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestId,
          "x-signature": signMercadoPagoNotification(
            webhookSecret,
            String(id),
            requestId,
          ),
        },
        body: JSON.stringify({
          type: "payment",
          action: "payment.updated",
          data: { id: String(id) },
        }),
      },
    );
    return { status: response.status, body: await response.json() };
  }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const send = (status: number, payload: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    const auth = request.headers.authorization ?? "";
    if (url.pathname === "/v1/payments" && request.method === "POST") {
      if (!auth.startsWith("Bearer TEST-"))
        return send(401, { message: "unauthorized" });
      if (failNextPayment > 0) {
        failNextPayment -= 1;
        return send(500, { message: "simulated outage" });
      }
      const input = await body(request);
      const id = sequence++;
      const pix = input.payment_method_id === "pix";
      const payment: Payment = {
        id,
        status: pix
          ? "pending"
          : input.token === "tok-reject-card"
            ? "rejected"
            : "approved",
        status_detail: pix ? "pending_waiting_transfer" : null,
        transaction_amount: input.transaction_amount,
        external_reference: input.external_reference,
        payment_method_id: input.payment_method_id,
        date_of_expiration: input.date_of_expiration ?? null,
        point_of_interaction: pix
          ? {
              transaction_data: {
                qr_code: `00020126-PIX-TESTE-${id}`,
                qr_code_base64:
                  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
                ticket_url: `https://pix.example.test/${id}`,
              },
            }
          : undefined,
      };
      payments.set(id, payment);
      return send(201, payment);
    }
    const match = url.pathname.match(/^\/v1\/payments\/(\d+)$/);
    if (match && request.method === "GET") {
      const payment = payments.get(Number(match[1]));
      return payment ? send(200, payment) : send(404, { message: "not found" });
    }
    if (
      url.pathname === "/api/v2/me/shipment/calculate" &&
      request.method === "POST"
    ) {
      const input = await body(request);
      shippingCalls.push(input);
      const weight = (input.package as { weight: number }).weight;
      // A slow, pricier destination, to test that late answers are ignored.
      const slow =
        (input.to as { postal_code: string }).postal_code === "69900000";
      if (slow) await new Promise((resolve) => setTimeout(resolve, 2500));
      return send(200, [
        {
          id: 1,
          name: "PAC",
          price: (18 + weight * 4 + (slow ? 80 : 0)).toFixed(2),
          delivery_time: 7,
          company: { name: "Correios" },
        },
        {
          id: 2,
          name: "SEDEX",
          price: (32 + weight * 6).toFixed(2),
          delivery_time: 2,
          company: { name: "Correios" },
        },
        {
          id: 3,
          name: ".Package",
          error: "Transportadora não atende este trecho.",
        },
      ]);
    }
    const cep = url.pathname.match(/^\/ws\/(\d{8})\/json\/$/);
    if (cep && request.method === "GET")
      return send(
        200,
        cep[1] === "00000000"
          ? { erro: "true" }
          : {
              cep: cep[1],
              logradouro: "Avenida Paulista",
              bairro: "Bela Vista",
              localidade: "São Paulo",
              uf: "SP",
            },
      );
    if (url.pathname === "/emails" && request.method === "POST") {
      emails.push((await body(request)) as { to: string[]; subject: string });
      return send(200, { id: randomUUID() });
    }
    // Test controls.
    const control = url.pathname.match(
      /^\/__test\/payments\/(\d+)\/(approve|cancel|reject)$/,
    );
    if (control && request.method === "POST") {
      const payment = payments.get(Number(control[1]));
      if (!payment) return send(404, {});
      payment.status = {
        approve: "approved",
        cancel: "cancelled",
        reject: "rejected",
      }[control[2]]!;
      const requestId = url.searchParams.get("requestId") ?? undefined;
      return send(200, await notify(payment.id, requestId));
    }
    if (
      url.pathname === "/__test/fail-next-payment" &&
      request.method === "POST"
    ) {
      failNextPayment += 1;
      return send(200, { failNextPayment });
    }
    if (url.pathname === "/__test/state")
      return send(200, {
        payments: [...payments.values()],
        emails,
        shippingCalls,
      });
    send(404, { message: "mock: unknown route" });
  });
  return new Promise<{ close: () => void }>((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({ close: () => server.close() }),
    ),
  );
}
