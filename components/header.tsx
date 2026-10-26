"use client";

import { Brand } from "./brand";
const links = [
  ["#cafes", "Nossos cafés"],
  ["#curadoria", "A curadoria"],
  ["#historia", "Nossa história"],
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
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
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
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        </details>
      </header>
    </>
  );
}
