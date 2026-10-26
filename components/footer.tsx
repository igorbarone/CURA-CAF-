import Link from "next/link";
import { Brand } from "./brand";
export function Footer() {
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
          <Link href="/#historia">Nossa história</Link>
        </nav>
        <p className="footer-note">
          Escolher muito bem.
          <br />
          Explicar de um jeito simples.
        </p>
      </div>
      <div className="wrap footer-bottom mono">
        <span>CURA CAFÉ · SITE EM DESENVOLVIMENTO</span>
        <span>SEM CHECKOUT OU PEDIDOS NESTA FASE</span>
      </div>
    </footer>
  );
}
