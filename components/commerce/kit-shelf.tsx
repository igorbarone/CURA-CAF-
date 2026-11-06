"use client";
import { useState } from "react";
import { formatBRL } from "../../lib/commerce/catalog";
import { useCart } from "./cart-provider";
// Published kits with an approved price (e.g. Kit descoberta). Renders
// nothing until the team prices one in the CMS.
export function KitShelf() {
  const cart = useCart();
  const [added, setAdded] = useState("");
  const kits = Object.values(cart.book).filter(
    (item) => item.kind === "bundle",
  );
  if (!kits.length) return null;
  return (
    <section className="kit-shelf" aria-labelledby="kit-shelf-title">
      <p className="eyebrow">PARA CONHECER MAIS DE UM PERFIL</p>
      <h2 id="kit-shelf-title">Kits da curadoria</h2>
      <ul>
        {kits.map((kit) => (
          <li key={kit.id}>
            <h3>{kit.name}</h3>
            <p>{kit.label}</p>
            <p className="package-price">{formatBRL(kit.unitPriceCents)}</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                cart.add(kit.id);
                setAdded(`${kit.name} no carrinho.`);
              }}
            >
              Adicionar {kit.name}
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="selection-feedback">
        {added}
      </p>
    </section>
  );
}
