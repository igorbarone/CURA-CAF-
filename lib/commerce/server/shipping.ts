// Melhor Envio (API v2, aggregates Correios and Jadlog): freight quotes and
// labels. Prices always come from the provider at request time.
// - Quote: one call per packed volume (POST /api/v2/me/shipment/calculate
//   with `package`); only services that answer for every volume are offered,
//   with prices summed and the slowest delivery time.
// - Labels: cart → checkout (paid from the Melhor Envio wallet) → generate
//   → print → tracking. One label per volume.
import type { Volume } from "../packing";

export type ShippingOption = {
  id: string;
  name: string;
  company: string;
  priceCents: number;
  days: number | null;
  volumes: number;
};
export type Address = {
  name: string;
  phone: string;
  email: string;
  document: string;
  companyDocument?: string;
  stateRegister?: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
};
export type LabelRequest = {
  orderId: string;
  serviceId: string;
  from: Address;
  to: Address;
  volume: Volume;
  products: { name: string; quantity: number; unitaryValue: number }[];
  invoiceKey: string | null;
  nonCommercial: boolean;
  orderUrl: string;
};
export type ShippingGateway = {
  quote(input: {
    toCep: string;
    volumes: Volume[];
    services: string[];
  }): Promise<ShippingOption[]>;
  // Label steps, each idempotent from the caller's saved state.
  addToCart(request: LabelRequest): Promise<{ id: string; priceCents: number }>;
  checkout(ids: string[]): Promise<void>;
  generate(ids: string[]): Promise<void>;
  print(ids: string[]): Promise<string>;
  tracking(ids: string[]): Promise<Record<string, string | null>>;
};
export class ShippingError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
  }
}
export const normalizeCep = (value: string) => value.replace(/\D/g, "");
type RawOption = {
  id: number | string;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: { name?: string };
};
// Combines per-volume answers: a service must quote every volume.
export function combineQuotes(perVolume: RawOption[][]): ShippingOption[] {
  const byService = new Map<string, ShippingOption>();
  perVolume.forEach((options, index) => {
    const valid = new Map<string, ShippingOption>();
    for (const option of options) {
      const raw = option.custom_price ?? option.price;
      const cents = Math.round(Number(raw) * 100);
      if (option.error || raw === undefined || !Number.isFinite(cents))
        continue;
      valid.set(String(option.id), {
        id: String(option.id),
        name: option.name,
        company: option.company?.name ?? "",
        priceCents: cents,
        days: option.custom_delivery_time ?? option.delivery_time ?? null,
        volumes: 1,
      });
    }
    if (index === 0) {
      for (const [id, option] of valid) byService.set(id, option);
      return;
    }
    for (const [id, current] of byService) {
      const next = valid.get(id);
      if (!next) {
        byService.delete(id);
        continue;
      }
      byService.set(id, {
        ...current,
        priceCents: current.priceCents + next.priceCents,
        days:
          current.days === null || next.days === null
            ? null
            : Math.max(current.days, next.days),
        volumes: current.volumes + 1,
      });
    }
  });
  return [...byService.values()].sort((a, b) => a.priceCents - b.priceCents);
}
export function melhorEnvioGateway({
  base,
  token,
  userAgent,
  originCep,
  fetchImpl = fetch,
}: {
  base: string;
  token: string;
  userAgent: string;
  originCep: string;
  fetchImpl?: typeof fetch;
}): ShippingGateway {
  async function call<T>(path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          // Melhor Envio requires "App name (technical contact e-mail)".
          "User-Agent": userAgent,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ShippingError("Melhor Envio indisponível");
    }
    if (!response.ok)
      throw new ShippingError(
        `Melhor Envio respondeu ${response.status}`,
        response.status,
      );
    return (await response.json()) as T;
  }
  const meVolume = (volume: Volume) => ({
    height: volume.heightCm,
    width: volume.widthCm,
    length: volume.lengthCm,
    weight: volume.weightGrams / 1000,
  });
  const meAddress = (address: Address) => ({
    name: address.name,
    phone: address.phone,
    email: address.email,
    ...(address.document ? { document: address.document } : {}),
    ...(address.companyDocument
      ? { company_document: address.companyDocument }
      : {}),
    ...(address.stateRegister ? { state_register: address.stateRegister } : {}),
    address: address.street,
    complement: address.complement,
    number: address.number,
    district: address.district,
    city: address.city,
    state_abbr: address.state,
    country_id: "BR",
    postal_code: normalizeCep(address.postalCode),
  });
  return {
    async quote({ toCep, volumes, services }) {
      const perVolume = await Promise.all(
        volumes.map((volume) =>
          call<RawOption[]>("/api/v2/me/shipment/calculate", {
            from: { postal_code: normalizeCep(originCep) },
            to: { postal_code: normalizeCep(toCep) },
            package: meVolume(volume),
            options: {
              insurance_value: volume.insuranceCents / 100,
              receipt: false,
              own_hand: false,
            },
            ...(services.length ? { services: services.join(",") } : {}),
          }),
        ),
      );
      return combineQuotes(
        perVolume.map((list) => (Array.isArray(list) ? list : [])),
      );
    },
    async addToCart(request) {
      const created = await call<{ id: string; price?: number | string }>(
        "/api/v2/me/cart",
        {
          service: Number(request.serviceId),
          from: meAddress(request.from),
          to: meAddress(request.to),
          products: request.products.map((product) => ({
            name: product.name,
            quantity: product.quantity,
            unitary_value: product.unitaryValue,
          })),
          volumes: [meVolume(request.volume)],
          options: {
            insurance_value: request.volume.insuranceCents / 100,
            receipt: false,
            own_hand: false,
            reverse: false,
            non_commercial: request.nonCommercial,
            ...(request.invoiceKey
              ? { invoice: { key: request.invoiceKey } }
              : {}),
            platform: "Cura Café",
            tags: [{ tag: request.orderId, url: request.orderUrl }],
          },
        },
      );
      return {
        id: created.id,
        priceCents: Math.round(Number(created.price ?? 0) * 100),
      };
    },
    async checkout(ids) {
      await call("/api/v2/me/shipment/checkout", { orders: ids });
    },
    async generate(ids) {
      await call("/api/v2/me/shipment/generate", { orders: ids });
    },
    async print(ids) {
      const printed = await call<{ url: string }>("/api/v2/me/shipment/print", {
        mode: "private",
        orders: ids,
      });
      return printed.url;
    },
    async tracking(ids) {
      const result = await call<
        Record<
          string,
          { tracking?: string | null; melhorenvio_tracking?: string | null }
        >
      >("/api/v2/me/shipment/tracking", { orders: ids });
      return Object.fromEntries(
        ids.map((id) => [
          id,
          result[id]?.tracking ?? result[id]?.melhorenvio_tracking ?? null,
        ]),
      );
    },
  };
}
