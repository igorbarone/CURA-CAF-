"use client";

import Link from "next/link";
import { Brand } from "./brand";
const links = [
  ["/cafes/", "Nossos cafés"],
  ["/#curadoria", "A curadoria"],
  ["/#historia", "Nossa história"],
] as const;
export function Header() {
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
          Carrinho <span className="mono">Em breve</span>
        </Link>
        <details className="mobile-menu">
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
