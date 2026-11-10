// Address lookup by CEP, done by the store's server (ViaCEP), so the browser
// talks only to the store. Only the CEP is sent; nothing is stored.
export type Address = {
  street: string;
  district: string;
  city: string;
  state: string;
};
export async function lookupCep(
  cep: string,
  {
    base = process.env.CEP_API_BASE ?? "https://viacep.com.br",
    fetchImpl = fetch,
  } = {},
): Promise<Address | null> {
  const digits = cep.replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return null;
  let response: Response;
  try {
    response = await fetchImpl(`${base}/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error("cep_unavailable");
  }
  if (!response.ok) throw new Error("cep_unavailable");
  const data = (await response.json()) as {
    erro?: boolean | string;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro) return null;
  return {
    street: data.logradouro ?? "",
    district: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}
