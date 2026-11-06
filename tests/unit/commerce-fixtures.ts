import { contentSchema, type Content } from "../../lib/content-schema";
import type {
  PaymentGateway,
  PaymentRequest,
  ProviderPayment,
} from "../../lib/commerce/server/mercadopago";
import { GatewayError } from "../../lib/commerce/server/mercadopago";
import type { ShippingGateway } from "../../lib/commerce/server/shipping";
import type { Notifier, OrderMessage } from "../../lib/commerce/server/notify";
// Test-only catalog with prices. These values exist only in tests and never
// describe a real Cura Café offer.
export function fixtureContent(): Content {
  const coffee = (id: string, sortOrder: number) => ({
    id,
    slug: id,
    name: id.toUpperCase(),
    description: "Café técnico de teste.",
    status: "published",
    sortOrder,
    primaryLotId: `${id}-lote`,
    tone: "cura",
    media: null,
  });
  const lot = (coffeeId: string) => ({
    id: `${coffeeId}-lote`,
    coffeeId,
    code: `TEST-${coffeeId.toUpperCase()}`,
    status: "published",
    sortOrder: 0,
    profile: "Perfil técnico",
    notes: ["Nota técnica"],
    producers: ["Produtor técnico"],
    preparations: ["Coado"],
    roast: "Média",
  });
  const offer = (
    id: string,
    lotId: string,
    price: number | null,
    grams: number,
  ) => ({
    id,
    lotId,
    status: "published",
    sku: id.toUpperCase(),
    currency: "BRL",
    unitPriceInCents: price,
    availableQuantity: null,
    weightInGrams: grams,
    grind: "Em grãos",
  });
  return contentSchema.parse({
    coffees: [coffee("cafe-a", 0), coffee("cafe-b", 1)],
    lots: [lot("cafe-a"), lot("cafe-b")],
    offers: [
      offer("a-250", "cafe-a-lote", 5000, 250),
      offer("a-500", "cafe-a-lote", 9000, 500),
      offer("a-1000", "cafe-a-lote", 19000, 1000),
      offer("b-250", "cafe-b-lote", 6000, 250),
      offer("b-sem-preco", "cafe-b-lote", null, 500),
    ],
    bundles: [
      {
        id: "kit-teste",
        name: "Kit técnico",
        description: "Kit de teste.",
        status: "published",
        sortOrder: 0,
        priceInCents: 10500,
        items: [
          { offerId: "a-250", quantity: 1 },
          { offerId: "b-250", quantity: 1 },
        ],
      },
      {
        id: "kit-sem-preco",
        name: "Kit sem preço",
        description: "Kit de teste.",
        status: "published",
        sortOrder: 1,
        priceInCents: null,
        items: [
          { offerId: "a-250", quantity: 1 },
          { offerId: "b-250", quantity: 1 },
        ],
      },
    ],
    home: {
      eyebrow: "T",
      title: "T",
      emphasis: "T",
      intro: "T",
      featuredCoffeeIds: [],
    },
  });
}
export const VALID_CPF = "52998224725";
export function fakePayments() {
  const store = new Map<string, ProviderPayment>();
  const created: PaymentRequest[] = [];
  let failNext = 0;
  let sequence = 1000;
  const gateway: PaymentGateway = {
    async create(request) {
      if (failNext > 0) {
        failNext -= 1;
        throw new GatewayError("rede", null);
      }
      created.push(request);
      const id = String(sequence++);
      const status =
        request.method === "pix"
          ? "pending"
          : request.token === "tok-reject"
            ? "rejected"
            : request.token === "tok-review"
              ? "in_process"
              : "approved";
      const payment: ProviderPayment = {
        id,
        status,
        statusDetail: status === "rejected" ? "cc_rejected_other_reason" : null,
        amountCents: request.amountCents,
        externalReference: request.orderId,
        method: request.method === "pix" ? "pix" : request.paymentMethodId,
        pix:
          request.method === "pix"
            ? {
                qrCode: `PIX-${id}`,
                qrCodeBase64: "iVBORw0KGgo=",
                ticketUrl: `https://pix.test/${id}`,
              }
            : null,
        expiresAt:
          request.method === "pix" ? request.expiresAt.toISOString() : null,
      };
      store.set(id, payment);
      return payment;
    },
    async get(id) {
      const payment = store.get(id);
      if (!payment) throw new GatewayError("não encontrado", 404);
      return { ...payment };
    },
  };
  return {
    gateway,
    created,
    store,
    failNext: (count = 1) => {
      failNext = count;
    },
    set(id: string, patch: Partial<ProviderPayment>) {
      store.set(id, { ...store.get(id)!, ...patch });
    },
  };
}
export function fakeShipping(
  options = [
    { id: "1", name: "PAC", company: "Correios", priceCents: 2290, days: 7 },
    { id: "2", name: "SEDEX", company: "Correios", priceCents: 4190, days: 2 },
  ],
) {
  const calls: { toCep: string; weightGrams: number }[] = [];
  let down = false;
  const gateway: ShippingGateway = {
    async quote(input) {
      calls.push(input);
      if (down) {
        const { ShippingError } =
          await import("../../lib/commerce/server/shipping");
        throw new ShippingError("fora do ar");
      }
      return options;
    },
  };
  return { gateway, calls, setDown: (value: boolean) => (down = value) };
}
export function fakeNotifier() {
  const sent: OrderMessage[] = [];
  const notifier: Notifier = {
    send: async (message) => void sent.push(message),
  };
  return { notifier, sent };
}
