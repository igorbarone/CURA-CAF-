"use client";
import { createContext, useContext, useEffect, useState } from "react";
const SelectionContext = createContext<{
  ids: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  message: string;
}>({ ids: [], add: () => {}, remove: () => {}, message: "" });
export function SelectionProvider({
  validIds,
  children,
}: {
  validIds: string[];
  children: React.ReactNode;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(
        sessionStorage.getItem("cura-offer-selection") ?? "[]",
      );
      if (Array.isArray(stored))
        setIds([
          ...new Set(
            stored.filter(
              (id): id is string =>
                typeof id === "string" && validIds.includes(id),
            ),
          ),
        ]);
    } catch {
      /* Storage is optional; selection still works in memory. */
    }
    setReady(true);
  }, [validIds]);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem("cura-offer-selection", JSON.stringify(ids));
      } catch {
        /* No persistence guarantee when browser storage is blocked. */
      }
  }, [ids, ready]);
  return (
    <SelectionContext.Provider
      value={{
        ids,
        message,
        add: (id) => {
          if (!validIds.includes(id)) return;
          setIds((previous) =>
            previous.includes(id) ? previous : [...previous, id],
          );
          setMessage(
            "Oferta incluída na seleção demonstrativa. Nenhum pedido ou reserva foi criado.",
          );
        },
        remove: (id) => {
          setIds((previous) => previous.filter((value) => value !== id));
          setMessage("Oferta removida da seleção.");
        },
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}
export const useSelection = () => useContext(SelectionContext);
