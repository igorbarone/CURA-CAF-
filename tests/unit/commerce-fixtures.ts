import { contentSchema, type Content } from "../../lib/content-schema";
import type {
  PaymentGateway,
  PaymentRequest,
  ProviderPayment,
} from "../../lib/commerce/server/asaas";
import { GatewayError } from "../../lib/commerce/server/asaas";
import type { Volume } from "../../lib/commerce/packing";
import type {
  LabelRequest,
  ShippingGateway,
} from "../../lib/commerce/server/shipping";
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
    // Fictitious logistics for tests: a bag 20 % heavier than its coffee.
    grossWeightInGrams: Math.round(grams * 1.2),
    packageHeightCm: grams >= 1000 ? 30 : grams >= 500 ? 25 : 20,
    packageWidthCm: grams >= 1000 ? 15 : 12,
    packageLengthCm: grams >= 1000 ? 10 : 7,
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
// Test boxes (fictitious measures): a small box for up to ~4 bags of 250 g
// and a larger one; 4 kg per volume at most (rules default).
export const TEST_BOXES = [
  {
    id: "caixa-p",
    label: "Caixa P (teste)",
    innerHeightCm: 12,
    innerWidthCm: 16,
    innerLengthCm: 22,
    outerHeightCm: 13,
    outerWidthCm: 17,
    outerLengthCm: 23,
    tareGrams: 150,
  },
  {
    id: "caixa-g",
    label: "Caixa G (teste)",
    innerHeightCm: 20,
    innerWidthCm: 26,
    innerLengthCm: 32,
    outerHeightCm: 21,
    outerWidthCm: 27,
    outerLengthCm: 33,
    tareGrams: 300,
  },
];
// Asaas stand-in with the gateway contract: charges keyed by order
// (externalReference), Pix QR for pending Pix, invoiceUrl for card.
export function fakePayments() {
  const store = new Map<string, ProviderPayment>();
  const created: PaymentRequest[] = [];
  const cancelled: string[] = [];
  let failNext = 0;
  let sequence = 1000;
  const gateway: PaymentGateway = {
    async create(request) {
      if (failNext > 0) {
        failNext -= 1;
        throw new GatewayError("rede", null);
      }
      const existing = [...store.values()].find(
        (payment) =>
          payment.externalReference === request.orderId &&
          payment.status !== "DELETED",
      );
      if (existing) return { ...existing };
      created.push(request);
      const id = `pay_${sequence++}`;
      const payment: ProviderPayment = {
        id,
        status: "PENDING",
        amountCents: request.amountCents,
        netAmountCents: null,
        externalReference: request.orderId,
        method: request.method,
        invoiceUrl: `https://asaas.test/i/${id}`,
        pix:
          request.method === "pix"
            ? { payload: `00020126-PIX-${id}`, encodedImage: "iVBORw0KGgo=" }
            : null,
      };
      store.set(id, payment);
      return { ...payment };
    },
    async get(id) {
      const payment = store.get(id);
      // Like the real client: a charge Asaas does not know reads as DELETED.
      if (!payment)
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
      return { ...payment };
    },
    async cancel(id) {
      cancelled.push(id);
      const payment = store.get(id);
      if (!payment) throw new GatewayError("não encontrado", 404);
      if (payment.status !== "PENDING")
        throw new GatewayError("não pode remover", 400);
      store.set(id, { ...payment, status: "DELETED" });
    },
  };
  return {
    gateway,
    created,
    cancelled,
    store,
    failNext: (count = 1) => {
      failNext = count;
    },
    set(id: string, patch: Partial<ProviderPayment>) {
      store.set(id, { ...store.get(id)!, ...patch });
    },
  };
}
// Melhor Envio stand-in: price grows with weight and distance (first CEP
// digit), PAC and .Package by default; labels recorded per volume.
export function fakeShipping({
  services = ["1", "3"],
}: { services?: string[] } = {}) {
  const calls: { toCep: string; volumes: Volume[]; services: string[] }[] = [];
  const carts: LabelRequest[] = [];
  const purchased: string[][] = [];
  let down = false;
  let failAt: string | null = null;
  const names: Record<string, [string, string]> = {
    "1": ["PAC", "Correios"],
    "2": ["SEDEX", "Correios"],
    "3": [".Package", "Jadlog"],
  };
  const fail = async (step: string) => {
    if (down || failAt === step) {
      const { ShippingError } =
        await import("../../lib/commerce/server/shipping");
      throw new ShippingError(`fora do ar (${step})`);
    }
  };
  let sequence = 1;
  const gateway: ShippingGateway = {
    async quote(input) {
      calls.push(input);
      await fail("quote");
      const region = Number(input.toCep[0]);
      return services
        .filter((id) => !input.services.length || input.services.includes(id))
        .map((id) => ({
          id,
          name: names[id][0],
          company: names[id][1],
          priceCents: input.volumes.reduce(
            (sum, volume) =>
              sum +
              1500 +
              region * 150 +
              Math.ceil(volume.weightGrams / 100) * 20 +
              (id === "3" ? 300 : 0),
            0,
          ),
          days: 3 + region,
          volumes: input.volumes.length,
        }))
        .sort((a, b) => a.priceCents - b.priceCents);
    },
    async addToCart(request) {
      await fail("cart");
      carts.push(request);
      return { id: `me-${sequence++}`, priceCents: 2000 };
    },
    async checkout(ids) {
      await fail("checkout");
      purchased.push(ids);
    },
    async generate() {
      await fail("generate");
    },
    async print(ids) {
      await fail("print");
      return `https://melhorenvio.test/print/${ids.join("-")}`;
    },
    async tracking(ids) {
      return Object.fromEntries(ids.map((id) => [id, `BR${id.toUpperCase()}`]));
    },
  };
  return {
    gateway,
    calls,
    carts,
    purchased,
    setDown: (value: boolean) => (down = value),
    failAt: (step: string | null) => (failAt = step),
  };
}
export function fakeNotifier() {
  const sent: OrderMessage[] = [];
  const notifier: Notifier = {
    send: async (message) => void sent.push(message),
  };
  return { notifier, sent };
}
