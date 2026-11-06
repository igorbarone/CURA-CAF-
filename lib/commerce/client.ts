// Client helpers for the commerce runtime. The static GitHub Pages build is
// compiled with NEXT_PUBLIC_COMMERCE=disabled, so none of this is reachable there.
export const commerceEnabled = process.env.NEXT_PUBLIC_COMMERCE === "enabled";
export type ApiError = { error: string; [key: string]: unknown };
export async function api<T>(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    return {
      ok: false as const,
      error: { error: "network_error" } as ApiError,
    };
  }
  const body = await response
    .json()
    .catch(() => ({ error: "invalid_response" }));
  return response.ok
    ? { ok: true as const, data: body as T }
    : { ok: false as const, error: body as ApiError, status: response.status };
}
// Plain-language messages for the API's error codes.
export const ERROR_MESSAGES: Record<string, string> = {
  network_error:
    "Sem conexão com a loja. Verifique sua internet e tente novamente.",
  invalid_input: "Confira os dados informados.",
  empty_cart: "Seu carrinho está vazio.",
  item_unavailable:
    "Um item deixou de estar à venda e foi retirado do carrinho.",
  insufficient_stock:
    "Não há estoque suficiente para um dos itens. Ajuste a quantidade.",
  shipping_unavailable:
    "Não conseguimos calcular o frete agora. Tente novamente em instantes.",
  shipping_changed: "O valor do frete mudou. Escolha a entrega novamente.",
  idempotency_conflict:
    "Este pedido já foi enviado com outros dados. Recarregue a página.",
  payment_unavailable:
    "O pagamento não pôde ser iniciado. Seu pedido foi guardado; tente novamente.",
  rate_limited: "Muitas tentativas seguidas. Aguarde um minuto.",
  internal_error: "Algo deu errado do nosso lado. Tente novamente.",
};
export const messageFor = (error: ApiError) =>
  ERROR_MESSAGES[error.error] ?? ERROR_MESSAGES.internal_error;
