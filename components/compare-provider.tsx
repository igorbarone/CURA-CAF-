"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { MAX_COMPARE } from "../lib/compare";
const CompareContext = createContext<{
  slugs: string[];
  ready: boolean;
  toggle: (slug: string) => void;
  replace: (slugs: string[]) => void;
}>({ slugs: [], ready: false, toggle: () => {}, replace: () => {} });
const KEY = "cura-compare";
export function CompareProvider({
  validSlugs,
  children,
}: {
  validSlugs: string[];
  children: React.ReactNode;
}) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(stored))
        setSlugs(
          [...new Set(stored)]
            .filter(
              (slug): slug is string =>
                typeof slug === "string" && validSlugs.includes(slug),
            )
            .slice(0, MAX_COMPARE),
        );
    } catch {
      /* Storage is optional; comparison still works in memory. */
    }
    setReady(true);
  }, [validSlugs]);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(KEY, JSON.stringify(slugs));
      } catch {
        /* No persistence guarantee when browser storage is blocked. */
      }
  }, [slugs, ready]);
  return (
    <CompareContext.Provider
      value={{
        slugs,
        ready,
        toggle: (slug) =>
          setSlugs((previous) =>
            previous.includes(slug)
              ? previous.filter((value) => value !== slug)
              : previous.length < MAX_COMPARE && validSlugs.includes(slug)
                ? [...previous, slug]
                : previous,
          ),
        replace: (next) =>
          setSlugs(
            next
              .filter((slug) => validSlugs.includes(slug))
              .slice(0, MAX_COMPARE),
          ),
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}
export const useCompare = () => useContext(CompareContext);
