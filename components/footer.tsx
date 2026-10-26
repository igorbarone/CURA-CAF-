import { getEditorial } from "../lib/editorial";
import Link from "next/link";
import { Brand } from "./brand";
export function Footer() {
  const { footer } = getEditorial();
  return (
    <footer className="site-footer">
      <div className="wrap footer-top">
        <div>
          <Brand />
          <p>da roça à cidade.</p>
        </div>
        <nav aria-label="Rodapé">
          <Link href="/cafes/">Nossos cafés</Link>
          <Link href="/#curadoria">A curadoria</Link>
          <Link href="/historia/">Nossa história</Link>
          <Link href="/descubra/">Descubra seu café</Link>
          <Link href="/clube/">Clube Cura</Link>
        </nav>
        <p className="footer-note">{footer.tagline}</p>
      </div>
      <div className="wrap footer-bottom mono">
        <span>CURA CAFÉ · DA ROÇA À CIDADE</span>
        <span>{footer.notice}</span>
      </div>
    </footer>
  );
}
