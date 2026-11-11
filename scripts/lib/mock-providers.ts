// Local stand-ins for Asaas, Melhor Envio, ViaCEP and Resend, used only by the
// commerce end-to-end tests. They answer the same HTTP shapes the real
// clients use (lib/commerce/server/asaas.ts, shipping.ts) and can send
// authenticated Asaas webhooks back to the store. No real provider is ever
// called and no real credential exists here.
import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";

type Payment = {
  id: string;
  customer: string;
  status: string;
  value: number;
  netValue: number;
  billingType: "PIX" | "CREDIT_CARD";
  externalReference: string;
  invoiceUrl: string;
  deleted: boolean;
  callback?: { successUrl: string };
};
export function startMockProviders({
  port,
  storeUrl,
  webhookToken,
}: {
  port: number;
  storeUrl: string;
  webhookToken: string;
}) {
  const payments = new Map<string, Payment>();
  const customers: { id: string; cpfCnpj: string }[] = [];
  const emails: { to: string[]; subject: string }[] = [];
  const shippingCalls: Record<string, unknown>[] = [];
  const carts: Record<string, unknown>[] = [];
  let failNextPayment = 0;
  let failShipping = false;
  let sequence = 5000;
  const body = (request: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve) => {
      let raw = "";
      request.on("data", (chunk) => (raw += chunk));
      request.on("end", () => resolve(raw ? JSON.parse(raw) : {}));
    });
  // Sends an Asaas-style webhook (event + payment) with the access token.
  async function notify(
    payment: Payment,
    event: string,
    eventId: string = `evt_${randomUUID()}`,
    token = webhookToken,
  ) {
    const response = await fetch(`${storeUrl}/api/webhooks/asaas/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "asaas-access-token": token,
      },
      body: JSON.stringify({ id: eventId, event, payment }),
    });
    return { status: response.status, body: await response.json() };
  }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const send = (status: number, payload: unknown) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    };
    const path = url.pathname;
    // ---- Asaas (base path /v3) ------------------------------------------
    if (path.startsWith("/v3/")) {
      if (request.headers.access_token !== "$aact_hmlg_chave_simulada")
        return send(401, { errors: [{ code: "invalid_access_token" }] });
      if (path === "/v3/customers" && request.method === "GET")
        return send(200, {
          data: customers.filter(
            (c) => c.cpfCnpj === url.searchParams.get("cpfCnpj"),
          ),
        });
      if (path === "/v3/customers" && request.method === "POST") {
        const input = await body(request);
        const customer = {
          id: `cus_${sequence++}`,
          cpfCnpj: String(input.cpfCnpj),
        };
        customers.push(customer);
        return send(200, customer);
      }
      if (path === "/v3/payments" && request.method === "GET")
        return send(200, {
          data: [...payments.values()].filter(
            (p) =>
              p.externalReference === url.searchParams.get("externalReference"),
          ),
        });
      if (path === "/v3/payments" && request.method === "POST") {
        if (failNextPayment > 0) {
          failNextPayment -= 1;
          return send(500, { errors: [{ code: "simulated_outage" }] });
        }
        const input = await body(request);
        const id = `pay_${sequence++}`;
        const payment: Payment = {
          id,
          customer: String(input.customer),
          status: "PENDING",
          value: Number(input.value),
          netValue: Number(input.value),
          billingType: input.billingType as Payment["billingType"],
          externalReference: String(input.externalReference),
          invoiceUrl: `${storeUrl.replace(/:\d+$/, `:${port}`)}/i/${id}`,
          deleted: false,
          callback: input.callback as Payment["callback"],
        };
        payments.set(id, payment);
        return send(200, payment);
      }
      const qr = path.match(/^\/v3\/payments\/(pay_\d+)\/pixQrCode$/);
      if (qr && request.method === "GET")
        return payments.get(qr[1])
          ? send(200, {
              encodedImage:
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
              payload: `00020126-PIX-TESTE-${qr[1]}`,
              expirationDate: "2099-01-01 23:59:59",
            })
          : send(404, {});
      const one = path.match(/^\/v3\/payments\/(pay_\d+)$/);
      if (one && request.method === "GET") {
        const payment = payments.get(one[1]);
        return payment ? send(200, payment) : send(404, {});
      }
      if (one && request.method === "DELETE") {
        const payment = payments.get(one[1]);
        if (!payment) return send(404, {});
        payment.deleted = true;
        return send(200, { deleted: true, id: payment.id });
      }
      return send(404, { message: "mock asaas: unknown route" });
    }
    // Hosted card page: "paying" confirms the charge and returns the buyer.
    const invoice = path.match(/^\/i\/(pay_\d+)$/);
    if (invoice) {
      const payment = payments.get(invoice[1]);
      if (!payment) return send(404, {});
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return response.end(
        `<!doctype html><html lang="pt-BR"><title>Asaas (simulado)</title><main><h1>Página de pagamento simulada</h1><form method="post" action="/i/${payment.id}/pay"><button>Pagar com cartão de teste</button></form></main></html>`,
      );
    }
    const pay = path.match(/^\/i\/(pay_\d+)\/pay$/);
    if (pay && request.method === "POST") {
      const payment = payments.get(pay[1]);
      if (!payment) return send(404, {});
      payment.status = "CONFIRMED";
      await notify(payment, "PAYMENT_CONFIRMED");
      response.writeHead(303, {
        Location: payment.callback?.successUrl ?? storeUrl,
      });
      return response.end();
    }
    // ---- Melhor Envio -------------------------------------------------------
    if (path === "/api/v2/me/shipment/calculate" && request.method === "POST") {
      const input = await body(request);
      shippingCalls.push(input);
      if (failShipping) return send(503, { message: "simulated outage" });
      const weight = (input.package as { weight: number }).weight;
      const cep = (input.to as { postal_code: string }).postal_code;
      // A slow, pricier destination, to test that late answers are ignored.
      const slow = cep === "69900000";
      if (slow) await new Promise((resolve) => setTimeout(resolve, 2500));
      const region = Number(cep[0]);
      const all = [
        {
          id: 1,
          name: "PAC",
          price: (16 + region * 1.5 + weight * 4 + (slow ? 80 : 0)).toFixed(2),
          delivery_time: 4 + region,
          company: { name: "Correios" },
        },
        {
          id: 3,
          name: ".Package",
          price: (18 + region * 1.2 + weight * 3.5).toFixed(2),
          delivery_time: 3 + region,
          company: { name: "Jadlog" },
        },
        {
          id: 2,
          name: "SEDEX",
          price: (32 + weight * 6).toFixed(2),
          delivery_time: 2,
          company: { name: "Correios" },
        },
      ];
      const wanted = String(input.services ?? "")
        .split(",")
        .filter(Boolean);
      return send(
        200,
        all.filter((o) => !wanted.length || wanted.includes(String(o.id))),
      );
    }
    if (path === "/api/v2/me/cart" && request.method === "POST") {
      carts.push(await body(request));
      return send(200, { id: `me-${sequence++}`, price: 21.5 });
    }
    if (
      ["/api/v2/me/shipment/checkout", "/api/v2/me/shipment/generate"].includes(
        path,
      )
    )
      return send(200, {});
    if (path === "/api/v2/me/shipment/print")
      return send(200, { url: "https://melhorenvio.example.test/print/1" });
    if (path === "/api/v2/me/shipment/tracking") {
      const input = await body(request);
      return send(
        200,
        Object.fromEntries(
          (input.orders as string[]).map((id) => [
            id,
            { tracking: `BR${id.replace(/\D/g, "")}TESTE` },
          ]),
        ),
      );
    }
    // ---- ViaCEP and Resend ------------------------------------------------
    const cep = path.match(/^\/ws\/(\d{8})\/json\/$/);
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
    if (path === "/emails" && request.method === "POST") {
      emails.push((await body(request)) as { to: string[]; subject: string });
      return send(200, { id: randomUUID() });
    }
    // ---- Test controls ------------------------------------------------------
    const control = path.match(
      /^\/__test\/payments\/(pay_\d+)\/(receive|overdue|refund)$/,
    );
    if (control && request.method === "POST") {
      const payment = payments.get(control[1]);
      if (!payment) return send(404, {});
      const [status, event] = {
        receive: ["RECEIVED", "PAYMENT_RECEIVED"],
        overdue: ["OVERDUE", "PAYMENT_OVERDUE"],
        refund: ["REFUNDED", "PAYMENT_REFUNDED"],
      }[control[2]]!;
      payment.status = status;
      return send(
        200,
        await notify(
          payment,
          event,
          url.searchParams.get("eventId") ?? undefined,
          url.searchParams.get("token") ?? undefined,
        ),
      );
    }
    if (path === "/__test/fail-next-payment" && request.method === "POST") {
      failNextPayment += 1;
      return send(200, { failNextPayment });
    }
    if (path === "/__test/shipping-down" && request.method === "POST") {
      failShipping = url.searchParams.get("value") !== "false";
      return send(200, { failShipping });
    }
    if (path === "/__test/state")
      return send(200, {
        payments: [...payments.values()],
        emails,
        shippingCalls,
        carts,
      });
    send(404, { message: "mock: unknown route" });
  });
  return new Promise<{ close: () => void }>((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({ close: () => server.close() }),
    ),
  );
}
