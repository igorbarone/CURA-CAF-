"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/experiencia/", label: "Início", icon: "inicio" },
  { href: "/experiencia/cafes/", label: "Meu Café", icon: "cafe" },
  { href: "/experiencia/aprender/", label: "Aprender", icon: "aprender" },
  { href: "/experiencia/preparar/", label: "Preparar", icon: "preparar" },
  { href: "/experiencia/barista/", label: "Barista", icon: "barista" },
];
const clean = (path: string) => path.replace(/\/+$/, "") || "/";

export function useActiveSection() {
  const pathname = clean(usePathname() ?? "/");
  return (href: string) => {
    const target = clean(href);
    if (target === "/experiencia") return pathname === target;
    // Origin and taste quiz belong to the "explore" path, under Aprender.
    if (target === "/experiencia/aprender")
      return [
        "/experiencia/aprender",
        "/experiencia/origem",
        "/experiencia/paladar",
      ].some((prefix) => pathname.startsWith(prefix));
    return pathname.startsWith(target);
  };
}

/** Desktop sub-navigation, below the site header. */
export function ExperienceTopNav() {
  const active = useActiveSection();
  return (
    <nav className="xp-topnav" aria-label="CURA Experience">
      <div className="wrap xp-topnav-inner">
        <Link href="/experiencia/" className="xp-topnav-brand mono">
          CURA EXPERIENCE
        </Link>
        <ul>
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** Mobile bottom bar: the brew guide is always one tap away. */
export function ExperienceBottomNav() {
  const active = useActiveSection();
  return (
    <nav className="xp-bottomnav" aria-label="CURA Experience (atalhos)">
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
