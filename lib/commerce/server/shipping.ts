// Freight quotes from Melhor Envio (aggregates Correios and carriers). Prices
// always come from the provider at request time; nothing is estimated here.
export type ShippingOption = {
  id: string;
  name: string;
  company: string;
  priceCents: number;
  days: number | null;
};
export type ShippingGateway = {
  quote(input: {
    toCep: string;
    weightGrams: number;
    insuranceCents: number;
  }): Promise<ShippingOption[]>;
};
export class ShippingError extends Error {}
export const normalizeCep = (value: string) => value.replace(/\D/g, "");
export function melhorEnvioGateway({
  base,
  token,
  userAgent,
  originCep,
  box,
  tareGrams,
  services,
  fetchImpl = fetch,
}: {
  base: string;
  token: string;
  userAgent: string;
  originCep: string;
  box: { height: number; width: number; length: number };
  tareGrams: number;
  services?: string;
  fetchImpl?: typeof fetch;
}): ShippingGateway {
  return {
    async quote({ toCep, weightGrams, insuranceCents }) {
      let response: Response;
      try {
        response = await fetchImpl(`${base}/api/v2/me/shipment/calculate`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "User-Agent": userAgent,
          },
          body: JSON.stringify({
            from: { postal_code: normalizeCep(originCep) },
            to: { postal_code: normalizeCep(toCep) },
            package: {
              ...box,
              weight: (weightGrams + tareGrams) / 1000,
            },
            options: {
              insurance_value: insuranceCents / 100,
              receipt: false,
              own_hand: false,
            },
            ...(services ? { services } : {}),
          }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        throw new ShippingError("Cálculo de frete indisponível");
      }
      if (!response.ok)
        throw new ShippingError(`Frete respondeu ${response.status}`);
      const raw = (await response.json()) as {
        id: number | string;
        name: string;
        price?: string;
        custom_price?: string;
        delivery_time?: number;
        custom_delivery_time?: number;
        error?: string;
        company?: { name?: string };
      }[];
      return raw
        .filter(
          (option) => !option.error && (option.custom_price ?? option.price),
        )
        .map((option) => ({
          id: String(option.id),
          name: option.name,
          company: option.company?.name ?? "",
          priceCents: Math.round(
            Number(option.custom_price ?? option.price) * 100,
          ),
          days: option.custom_delivery_time ?? option.delivery_time ?? null,
        }))
        .filter((option) => Number.isFinite(option.priceCents))
        .sort((a, b) => a.priceCents - b.priceCents);
    },
  };
}
