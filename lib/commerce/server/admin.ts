// Server-side helpers for the operations panel (/admin). Pages and the
// action route share them, so every request checks the same session.
import { cookies } from "next/headers";
import { ADMIN_COOKIE, validSession } from "./admin-auth";
import { readConfig } from "./config";

export type AdminState =
  { kind: "disabled"; reason: string } | { kind: "login" } | { kind: "ok" };
export async function adminState(): Promise<AdminState> {
  const config = readConfig();
  if (!config.enabled)
    return {
      kind: "disabled",
      reason:
        "A loja está desligada neste ambiente (CURA_COMMERCE, banco e ORDER_TOKEN_SECRET).",
    };
  if (!config.admin.enabled)
    return {
      kind: "disabled",
      reason:
        "Defina ADMIN_PASSWORD_HASH (npm run ops -- admin:hash) e ADMIN_SESSION_SECRET (32+ caracteres) no servidor.",
    };
  const store = await cookies();
  return validSession(
    config.admin.sessionSecret,
    store.get(ADMIN_COOKIE)?.value,
  )
    ? { kind: "ok" }
    : { kind: "login" };
}
export function requestHasSession(request: Request) {
  const config = readConfig();
  if (!config.admin.enabled) return false;
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  return validSession(config.admin.sessionSecret, value);
}
// Messages shown after an action (?ok= / ?erro=), from a fixed list only.
export const ADMIN_MESSAGES: Record<string, string> = {
  senha: "Senha incorreta.",
  sessao: "Sessão expirada. Entre de novo.",
  preparing: "Pedido marcado como em preparação.",
  shipped: "Pedido marcado como enviado. O cliente foi avisado.",
  delivered: "Pedido marcado como entregue.",
  label: "Etiqueta processada. Confira o status abaixo.",
  tracking: "Rastreio atualizado.",
  stock: "Estoque ajustado e registrado.",
  paused: "Venda do SKU pausada.",
  resumed: "Venda do SKU retomada.",
  reconcile: "Cobranças pendentes revisadas.",
  invalid_transition: "Essa mudança não é permitida no status atual.",
  invalid_input: "Confira os campos (rastreio, chave da NF-e ou quantidade).",
  shipping_unavailable:
    "Melhor Envio não configurado para etiquetas (token, remetente e CEP de origem).",
  not_found: "Pedido não encontrado.",
  stock_error:
    "Ajuste recusado: SKU inexistente, motivo vazio ou estoque negativo.",
  erro: "Não foi possível concluir. Tente de novo.",
};
