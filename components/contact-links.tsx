import type { ContactLink } from "../lib/contact";
// Renders nothing until the team configures a real channel in the CMS.
export function ContactLinks({
  links,
  note = "A conversa não cria pedido, reserva ou contrato.",
}: {
  links: ContactLink[];
  note?: string;
}) {
  if (!links.length) return null;
  return (
    <div className="contact-links">
      <ul>
        {links.map((link, index) => (
          <li key={link.kind}>
            <a
              className={index === 0 ? "button" : "text-link"}
              href={link.href}
              target={link.kind === "email" ? undefined : "_blank"}
              rel={link.kind === "email" ? undefined : "noopener noreferrer"}
            >
              {link.label}
              {link.kind !== "email" && (
                <span className="visually-hidden"> (abre em nova aba)</span>
              )}
            </a>
          </li>
        ))}
      </ul>
      <p className="availability">{note}</p>
    </div>
  );
}
