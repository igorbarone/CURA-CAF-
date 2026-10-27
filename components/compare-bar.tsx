"use client";
import Link from "next/link";
import { useCompare } from "./compare-provider";
import { MAX_COMPARE, comparePath } from "../lib/compare";
export function CompareBar() {
  const { slugs, replace } = useCompare();
  if (!slugs.length) return null;
  return (
    <aside className="compare-bar" aria-label="Comparação de cafés">
      <p>
        <strong>
          {slugs.length} de {MAX_COMPARE}
        </strong>{" "}
        {slugs.length === 1
          ? "café escolhido. Escolha mais um para comparar."
          : "cafés escolhidos para comparar."}
      </p>
      <div>
        <button type="button" className="text-link" onClick={() => replace([])}>
          Limpar
        </button>
        <Link className="button" href={comparePath(slugs)}>
          Comparar agora
        </Link>
      </div>
    </aside>
  );
}
