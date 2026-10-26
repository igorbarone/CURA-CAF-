"use client";

import Link from "next/link";
import { useSelection } from "./selection-provider";
import { Brand } from "./brand";
const links = [
  ["/cafes/", "Nossos cafés"],
  ["/#curadoria", "A curadoria"],
  ["/descubra/", "Descubra seu café"],
  ["/clube/", "Clube Cura"],
  ["/historia/", "Nossa história"],
] as const;
export function Header() {
  const { ids } = useSelection();
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="site-header wrap">
        <Brand />
        <nav className="desktop-nav" aria-label="Principal">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <Link className="header-cart" href="/carrinho/">
          Carrinho{" "}
          <span className="mono">
            {ids.length
              ? `${ids.length} na seleção · demonstração`
              : "Em breve"}
          </span>
        </Link>
        <details
          className="mobile-menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.removeAttribute("open");
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            Menu <span aria-hidden="true">＋</span>
          </summary>
          <nav
            aria-label="Principal mobile"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a"))
                event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            {links.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
        </details>
      </header>
    </>
  );
}
