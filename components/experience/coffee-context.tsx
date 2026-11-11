"use client";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { STORAGE, readLocal, writeLocal } from "../../lib/experience/storage";

// The coffee the person said they have, shared by every Experience page
// (Lab, Barista, quiz, journal). Kept in this browser only; easy to change.
type CoffeeRef = { slug: string; name: string };
type Value = {
  coffees: CoffeeRef[];
  coffeeSlug: string;
  coffee: CoffeeRef | undefined;
  setCoffee: (slug: string) => void;
  ready: boolean;
};
const Context = createContext<Value | null>(null);

export function CoffeeContextProvider({
  coffees,
  children,
}: {
  coffees: CoffeeRef[];
  children: React.ReactNode;
}) {
  const [coffeeSlug, setSlug] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = readLocal<string>(STORAGE.coffee, "");
    if (coffees.some((item) => item.slug === saved)) setSlug(saved);
    setReady(true);
  }, [coffees]);
  const setCoffee = useCallback(
    (slug: string) => {
      const value = coffees.some((item) => item.slug === slug) ? slug : "";
      setSlug(value);
      writeLocal(STORAGE.coffee, value);
    },
    [coffees],
  );
  return (
    <Context.Provider
      value={{
        coffees,
        coffeeSlug,
        coffee: coffees.find((item) => item.slug === coffeeSlug),
        setCoffee,
        ready,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCoffeeContext() {
  const value = useContext(Context);
  if (!value) throw new Error("CoffeeContextProvider ausente");
  return value;
}

/** "Seu café: SALSA · trocar" — visible only once a coffee was chosen. */
export function CoffeeContextBar() {
  const { coffee } = useCoffeeContext();
  if (!coffee) return null;
  return (
    <div className="xp-context-bar">
      <div className="wrap xp-context-inner">
        <span className="mono">SEU CAFÉ</span>
        <Link
          href={`/experiencia/cafes/${coffee.slug}/`}
          className="xp-context-name"
        >
          {coffee.name}
        </Link>
        <Link
          href="/experiencia/cafes/"
          className="xp-text-link xp-context-change"
        >
          Trocar
        </Link>
        <Link
          href={`/experiencia/preparar/?cafe=${coffee.slug}`}
          className="xp-context-brew"
        >
          Preparar
        </Link>
      </div>
    </div>
  );
}
