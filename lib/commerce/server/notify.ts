import { formatBRL } from "../catalog";
import { log } from "./log";
// Transactional e-mail via Resend. Without credentials nothing is sent and
// only a redacted log line records that the message was skipped.
export type OrderMessage = {
  kind:
    | "order_received"
    | "payment_confirmed"
    | "payment_failed"
    | "order_expired"
    | "order_shipped";
  to: string;
  firstName: string;
  orderId: string;
  orderUrl: string;
  totalCents: number;
  tracking?: { code: string; carrier: string | null } | null;
};
export type Notifier = { send(message: OrderMessage): Promise<void> };
const SUBJECT: Record<OrderMessage["kind"], string> = {
  order_received: "Recebemos seu pedido",
  payment_confirmed: "Pagamento confirmado",
  payment_failed: "Pagamento não aprovado",
  order_expired: "Prazo de pagamento encerrado",
  order_shipped: "Seu pedido foi enviado",
};
const BODY: Record<OrderMessage["kind"], string> = {
  order_received:
    "Seu pedido foi registrado. Conclua o pagamento pelo link abaixo dentro do prazo.",
  payment_confirmed:
    "O pagamento foi confirmado. Vamos preparar o envio e avisaremos quando sair.",
  payment_failed:
    "O pagamento não foi aprovado e o pedido não será enviado. Você pode tentar novamente na loja.",
  order_expired:
    "O prazo para pagar terminou e o pedido foi cancelado. Nada foi cobrado; você pode montar o carrinho de novo na loja.",
  order_shipped: "Seu pedido saiu para entrega.",
};
const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
export function renderMessage(message: OrderMessage) {
  const tracking = message.tracking
    ? `<p>Rastreio: <strong>${escape(message.tracking.code)}</strong>${message.tracking.carrier ? ` (${escape(message.tracking.carrier)})` : ""}</p>`
    : "";
  return {
    subject: `Cura Café · ${SUBJECT[message.kind]}`,
    html: `<p>Olá, ${escape(message.firstName)}.</p><p>${BODY[message.kind]}</p><p>Total: ${formatBRL(message.totalCents)}</p>${tracking}<p><a href="${escape(message.orderUrl)}">Acompanhar pedido</a></p><p>Cura Café · Democratizando café especial.</p>`,
  };
}
export function resendNotifier({
  base,
  apiKey,
  from,
  fetchImpl = fetch,
}: {
  base: string;
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
}): Notifier {
  return {
    async send(message) {
      const { subject, html } = renderMessage(message);
      try {
        const response = await fetchImpl(`${base}/emails`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `${message.orderId}:${message.kind}`,
          },
          body: JSON.stringify({ from, to: [message.to], subject, html }),
          signal: AbortSignal.timeout(10_000),
        });
        log("email.sent", {
          kind: message.kind,
          orderId: message.orderId,
          ok: response.ok,
        });
      } catch {
        // E-mail never blocks a payment or an order transition.
        log("email.failed", { kind: message.kind, orderId: message.orderId });
      }
    },
  };
}
export const skippedNotifier: Notifier = {
  async send(message) {
    log("email.skipped", { kind: message.kind, orderId: message.orderId });
  },
};
