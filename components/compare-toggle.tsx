"use client";
import Link from "next/link";
import { useCompare } from "./compare-provider";
import { MAX_COMPARE, comparePath } from "../lib/compare";
export function CompareToggle({
  slug,
  name,
  showLink = true,
}: {
  slug: string;
  name: string;
  showLink?: boolean;
}) {
  const { slugs, toggle } = useCompare();
  const selected = slugs.includes(slug);
  const full = !selected && slugs.length >= MAX_COMPARE;
  return (
    <span className="compare-toggle">
      <button
        type="button"
        aria-pressed={selected}
        disabled={full}
        onClick={() => toggle(slug)}
        aria-label={`Comparar ${name}`}
        title={full ? `Compare até ${MAX_COMPARE} cafés` : undefined}
      >
        <span aria-hidden="true">{selected ? "✓" : "+"}</span> Comparar
      </button>
      {showLink && selected && slugs.length > 1 && (
        <Link className="compare-now" href={comparePath(slugs)}>
          Ver comparação ({slugs.length})
        </Link>
      )}
    </span>
  );
}
// Opens the comparator with the visitor's current choices, if any.
export function CompareLink() {
  const { slugs } = useCompare();
  return (
    <Link className="text-link" href={comparePath(slugs)}>
      {slugs.length > 1
        ? `Ver comparação (${slugs.length})`
        : "Comparar com outros cafés"}
    </Link>
  );
}
