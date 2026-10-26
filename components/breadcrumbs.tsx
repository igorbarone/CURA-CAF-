import Link from "next/link";
export function Breadcrumbs({
  current,
  product = false,
}: {
  current: string;
  product?: boolean;
}) {
  return (
    <nav className="breadcrumbs mono" aria-label="Caminho de navegação">
      <ol>
        <li>
          <Link href="/">Início</Link>
        </li>
        {product && (
          <li>
            <Link href="/cafes/">Cafés</Link>
          </li>
        )}
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}
