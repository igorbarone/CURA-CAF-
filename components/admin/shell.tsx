import Link from "next/link";
import { ADMIN_MESSAGES, adminState } from "../../lib/commerce/server/admin";
import { formatBRL } from "../../lib/commerce/catalog";

const NAV = [
  { href: "/admin/", label: "Visão geral" },
  { href: "/admin/pedidos/", label: "Pedidos" },
  { href: "/admin/estoque/", label: "Estoque" },
  { href: "/admin/catalogo/", label: "Produtos e lotes" },
];
export const brl = formatBRL;
export const when = (value: string | Date | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      })
    : "—";
export const FINANCIAL: Record<string, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  payment_failed: "Pagamento recusado",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
};
export const LOGISTICS: Record<string, string> = {
  unfulfilled: "A preparar",
  preparing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
};
// Gate + frame of every panel page. Without a session it shows the login.
export async function AdminShell({
  current,
  title,
  search,
  children,
}: {
  current: string;
  title: string;
  search: Record<string, string | string[] | undefined>;
  children: React.ReactNode;
}) {
  const state = await adminState();
  const ok = typeof search.ok === "string" ? ADMIN_MESSAGES[search.ok] : null;
  const error =
    typeof search.erro === "string" ? ADMIN_MESSAGES[search.erro] : null;
  if (state.kind !== "ok")
    return (
      <main id="conteudo" className="admin admin-login">
        <p className="eyebrow">CURA CAFÉ · OPERAÇÃO</p>
        <h1>Painel da loja</h1>
        {state.kind === "disabled" ? (
          <p className="admin-note">Painel desativado. {state.reason}</p>
        ) : (
          <form method="post" action="/api/admin/login/">
            <label htmlFor="admin-password">Senha da equipe</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <button type="submit" className="button">
              Entrar
            </button>
            {error && (
              <p role="alert" className="cart-warning">
                {error}
              </p>
            )}
          </form>
        )}
      </main>
    );
  return (
    <main id="conteudo" className="admin">
      <header className="admin-header">
        <p className="eyebrow">CURA CAFÉ · OPERAÇÃO</p>
        <nav aria-label="Painel">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={item.href === current ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form method="post" action="/api/admin/logout/">
          <button type="submit" className="text-link">
            Sair
          </button>
        </form>
      </header>
      <h1>{title}</h1>
      {ok && (
        <p role="status" className="admin-ok">
          {ok}
        </p>
      )}
      {error && (
        <p role="alert" className="cart-warning">
          {error}
        </p>
      )}
      {children}
    </main>
  );
}
// Small form posting one panel action.
export function ActionForm({
  action,
  back,
  label,
  fields = {},
  children,
  secondary = false,
}: {
  action: string;
  back: string;
  label: string;
  fields?: Record<string, string>;
  children?: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <form method="post" action="/api/admin/action/" className="admin-action">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="back" value={back} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <button type="submit" className={secondary ? "text-link" : "button"}>
        {label}
      </button>
    </form>
  );
}
