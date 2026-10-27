import { getEditorial } from "../lib/editorial";
import Link from "next/link";
import { Brand } from "./brand";
import { contactLinks, getContact } from "../lib/contact";
export function Footer() {
  const { footer } = getEditorial();
  const contact = contactLinks(getContact(), "Olá, Cura Café!");
  return (
    <footer className="site-footer">
      <div className="wrap footer-top">
        <div>
          <Brand inverse />
          <p>da roça à cidade.</p>
        </div>
        <nav aria-label="Rodapé">
          <Link href="/cafes/">Nossos cafés</Link>
          <Link href="/#curadoria">A curadoria</Link>
          <Link href="/historia/">Nossa história</Link>
          <Link href="/descubra/">Descubra seu café</Link>
          <Link href="/clube/">Clube Cura</Link>
          <Link href="/empresas/">Para empresas</Link>
        </nav>
        <p className="footer-note">{footer.tagline}</p>
        {contact.length > 0 && (
          <ul className="footer-contact" aria-label="Fale com a Cura">
            {contact.map((link) => (
              <li key={link.kind}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="wrap footer-bottom mono">
        <span>CURA CAFÉ · DA ROÇA À CIDADE</span>
        <span>{footer.notice}</span>
      </div>
    </footer>
  );
}
